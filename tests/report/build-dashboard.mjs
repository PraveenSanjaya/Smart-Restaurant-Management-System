#!/usr/bin/env node
// SE3112 – Unified reporting for the test-automation pipeline.
// Collects the output of every stage from ./artifacts and renders one dashboard:
//   artifacts/index.html          – open in a browser (links to every detailed report)
//   artifacts/pipeline-summary.md – appended to the GitHub Actions job summary
// Stages that did not run are shown as "not run" instead of failing the report.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const ART = resolve(ROOT, args.includes('--artifacts') ? args[args.indexOf('--artifacts') + 1] : 'artifacts');
const TEAM = JSON.parse(readFileSync(join(ROOT, 'tests/report/team.json'), 'utf8'));

const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, '')) : null);
const link = (p) => (existsSync(p) ? relative(ART, p).split('\\').join('/') : null);
const walk = (dir, test, out = []) => {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, test, out);
    else if (test(e.name)) out.push(p);
  }
  return out;
};

// Same source and rounding as the quality gate, so both report identical numbers.
function coberturaCoverage() {
  const file = join(ART, 'coverage/report/Cobertura.xml');
  if (!existsSync(file)) return null;
  const root = readFileSync(file, 'utf8').match(/<coverage [^>]+>/)?.[0] || '';
  const rate = (name) => Math.round(Number(root.match(new RegExp(`${name}="([0-9.]+)"`))?.[1] || 0) * 1000) / 10;
  return { line: rate('line-rate'), branch: rate('branch-rate') };
}

// ── Unit tests (TRX) ────────────────────────────────────────────────────────────────────────
function unitTests() {
  const trx = walk(join(ART, 'unit'), (n) => n.endsWith('.trx'));
  if (!trx.length) return null;
  const projects = trx.map((file) => {
    const xml = readFileSync(file, 'utf8');
    const counters = xml.match(/<Counters [^>]+>/)?.[0] || '';
    const n = (k) => Number(counters.match(new RegExp(`${k}="(\\d+)"`))?.[1] || 0);
    const suites = {};
    // One UnitTestResult per executed case (every theory row), named Namespace.Class.Method(args).
    for (const [, name] of xml.matchAll(/<UnitTestResult [^>]*testName="([^"]+)"/g)) {
      const suite = name.includes('.UnitMocking.') ? 'UnitMocking' : name.includes('.MutationHardening.') ? 'MutationHardening' : 'Existing (SE3022)';
      suites[suite] = (suites[suite] || 0) + 1;
    }
    const failedNames = [...xml.matchAll(/<UnitTestResult [^>]*testName="([^"]+)"[^>]*outcome="Failed"/g)].map((m) => m[1]);
    return { name: file.split(/[\\/]/).pop().replace('.trx', ''), total: n('total'), passed: n('passed'), failed: n('failed'), suites, failedNames };
  });
  const sum = (k) => projects.reduce((s, p) => s + p[k], 0);
  const suites = {};
  for (const p of projects) for (const [k, v] of Object.entries(p.suites)) suites[k] = (suites[k] || 0) + v;
  return {
    status: sum('failed') === 0 ? 'passed' : 'failed',
    total: sum('total'), passed: sum('passed'), failed: sum('failed'), projects, suites,
    coverage: coberturaCoverage(),
    report: link(join(ART, 'coverage/report/index.html')),
  };
}

// ── Mutation (Stryker JSON) ─────────────────────────────────────────────────────────────────
function mutation() {
  const dir = join(ART, 'mutation');
  if (!existsSync(dir)) return null;
  const runs = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const json = readJson(join(dir, d.name, 'reports/mutation-report.json'));
    if (!json) return null;
    const c = { Killed: 0, Survived: 0, NoCoverage: 0, Timeout: 0, CompileError: 0, Ignored: 0, RuntimeError: 0 };
    for (const f of Object.values(json.files)) for (const m of f.mutants) c[m.status] = (c[m.status] || 0) + 1;
    const detected = c.Killed + c.Timeout;
    const undetected = c.Survived + c.NoCoverage;
    const score = detected + undetected ? Math.round((detected / (detected + undetected)) * 10000) / 100 : 0;
    const [service, mode = 'hardened'] = d.name.split('-');
    return { name: d.name, service, mode, score, ...c, thresholds: json.thresholds, report: link(join(dir, d.name, 'reports/mutation-report.html')) };
  }).filter(Boolean);
  if (!runs.length) return null;
  const gated = runs.filter((r) => r.mode !== 'baseline');
  const status = gated.every((r) => r.score >= (r.thresholds?.break ?? 0)) ? 'passed' : 'failed';
  return { status, runs };
}

// ── Load (k6 handleSummary JSON) ────────────────────────────────────────────────────────────
function load() {
  const files = walk(join(ART, 'load'), (n) => n.endsWith('-summary.json'));
  if (!files.length) return null;
  const runs = files.map((file) => {
    const data = readJson(file);
    const v = (m, k) => data.metrics[m]?.values?.[k];
    const thresholds = Object.entries(data.metrics).flatMap(([metric, m]) => Object.entries(m.thresholds || {}).map(([expr, t]) => ({ metric, expr, ok: t.ok })));
    const name = file.split(/[\\/]/).pop().replace('-summary.json', '');
    return {
      name,
      passed: thresholds.every((t) => t.ok),
      thresholdsPassed: thresholds.filter((t) => t.ok).length,
      thresholdsTotal: thresholds.length,
      failedThresholds: thresholds.filter((t) => !t.ok).map((t) => `${t.metric} ${t.expr}`),
      requests: v('http_reqs', 'count'), rps: v('http_reqs', 'rate'), errorRate: v('http_req_failed', 'rate'),
      p95: v('http_req_duration', 'p(95)'), vusMax: v('vus_max', 'max') ?? v('vus_max', 'value'),
      bookings: v('bookings_created', 'count') ?? v('race_bookings_created', 'count'),
      conflicts: v('booking_conflicts', 'count') ?? v('race_conflicts', 'count'),
      report: link(file.replace('-summary.json', '-report.html')),
    };
  });
  // Stress/spike/soak are exploratory: they are expected to breach SLOs and do not fail the stage.
  const gating = runs.filter((r) => !/journey-(stress|spike|soak)/.test(r.name));
  return { status: gating.every((r) => r.passed) ? 'passed' : 'failed', runs };
}

// ── Quality gate ────────────────────────────────────────────────────────────────────────────
function quality() {
  const q = readJson(join(ART, 'quality/quality-report.json'));
  if (!q) return null;
  return { status: q.passed ? 'passed' : 'failed', ...q.metrics, conditions: q.conditions, report: link(join(ART, 'quality/quality-report.html')) };
}

const stages = { unit: unitTests(), mutation: mutation(), load: load(), quality: quality() };
const overall = Object.values(stages).some((s) => s?.status === 'failed') ? 'failed' : Object.values(stages).every((s) => !s) ? 'not run' : 'passed';
const icon = (s) => (s === 'passed' ? '✅' : s === 'failed' ? '❌' : '⏭️');
const pct = (n) => (n === undefined || n === null ? '–' : `${Number(n).toFixed(2)}%`);
const ms = (n) => (n === undefined || n === null ? '–' : `${Number(n).toFixed(0)} ms`);

const headline = {
  unit: (s) => `${s.passed}/${s.total} tests passed · coverage ${s.coverage ? `${s.coverage.line}% line / ${s.coverage.branch}% branch` : 'n/a'}`,
  mutation: (s) => s.runs.map((r) => `${r.service} ${r.mode}: ${r.score}%`).join(' · '),
  load: (s) => s.runs.map((r) => `${r.name}: ${r.thresholdsPassed}/${r.thresholdsTotal} thresholds, p95 ${ms(r.p95)}`).join(' · '),
  quality: (s) => `maintainability ${s.ratings.maintainability} · security ${s.ratings.security} · reliability ${s.ratings.reliability} · debt ${s.technicalDebt.readable} · ${s.codeSmells.total} smells`,
};

// ── Markdown (GitHub job summary) ───────────────────────────────────────────────────────────
let md = `## ${icon(overall)} SE3112 test-automation pipeline – ${overall}\n\n| Stage | Owner | Tools | Status | Result |\n|---|---|---|:---:|---|\n`;
for (const [key, role] of Object.entries(TEAM.roles)) {
  const s = stages[key];
  md += `| ${role.title} | ${role.owner} | ${role.tools} | ${icon(s?.status)} | ${s ? headline[key](s) : 'not run'} |\n`;
}
if (stages.mutation) {
  md += `\n**Mutation score**\n\n| Run | Score | Killed | Survived | No coverage | Timeout |\n|---|---:|---:|---:|---:|---:|\n`;
  for (const r of stages.mutation.runs) md += `| ${r.name} | ${pct(r.score)} | ${r.Killed} | ${r.Survived} | ${r.NoCoverage} | ${r.Timeout} |\n`;
}
if (stages.load) {
  md += `\n**Load tests**\n\n| Run | Requests | Throughput | Error rate | p95 | Max VUs | Bookings | 409 conflicts | Thresholds |\n|---|---:|---:|---:|---:|---:|---:|---:|:---:|\n`;
  for (const r of stages.load.runs) md += `| ${r.name} | ${r.requests} | ${Number(r.rps || 0).toFixed(1)}/s | ${pct((r.errorRate || 0) * 100)} | ${ms(r.p95)} | ${r.vusMax} | ${r.bookings ?? '–'} | ${r.conflicts ?? '–'} | ${r.thresholdsPassed}/${r.thresholdsTotal} |\n`;
}
writeFileSync(join(ART, 'pipeline-summary.md'), md);

// ── HTML dashboard ──────────────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const a = (href, text) => (href ? `<a href="${esc(href)}">${esc(text)}</a>` : '');
const card = (key) => {
  const role = TEAM.roles[key];
  const s = stages[key];
  return `<section class="card ${s?.status || 'skipped'}"><header><h2>${esc(role.title)}</h2><span class="pill">${s?.status || 'not run'}</span></header>
<p class="owner">${esc(role.owner)} · <span>${esc(role.tools)}</span></p><p class="headline">${esc(s ? headline[key](s) : 'Stage did not run in this pipeline execution.')}</p>${s ? details[key](s) : ''}</section>`;
};
const details = {
  unit: (s) => `<table><tr><th>Project</th><th>Passed</th><th>Failed</th></tr>${s.projects.map((p) => `<tr><td>${esc(p.name)}</td><td>${p.passed}</td><td>${p.failed}</td></tr>`).join('')}</table>
<table><tr><th>Suite</th><th>Tests</th></tr>${Object.entries(s.suites).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('')}</table>
${s.projects.flatMap((p) => p.failedNames).map((n) => `<p class="bad">✗ ${esc(n)}</p>`).join('')}<p>${a(s.report, 'Coverage report →')}</p>`,
  mutation: (s) => `<table><tr><th>Run</th><th>Score</th><th>Killed</th><th>Survived</th><th>No cov.</th><th></th></tr>${s.runs.map((r) => `<tr><td>${esc(r.name)}</td><td><b>${pct(r.score)}</b></td><td>${r.Killed}</td><td>${r.Survived}</td><td>${r.NoCoverage}</td><td>${a(r.report, 'report')}</td></tr>`).join('')}</table>`,
  load: (s) => `<table><tr><th>Run</th><th>Req</th><th>Err</th><th>p95</th><th>VUs</th><th>Thresholds</th><th></th></tr>${s.runs.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.requests}</td><td>${pct((r.errorRate || 0) * 100)}</td><td>${ms(r.p95)}</td><td>${r.vusMax}</td><td class="${r.passed ? 'ok' : 'bad'}">${r.thresholdsPassed}/${r.thresholdsTotal}</td><td>${a(r.report, 'report')}</td></tr>`).join('')}</table>
${s.runs.flatMap((r) => r.failedThresholds.map((t) => `<p class="bad">✗ ${esc(r.name)}: ${esc(t)}</p>`)).join('')}`,
  quality: (s) => `<table><tr><th>Condition</th><th>Actual</th><th>Required</th></tr>${s.conditions.map((c) => `<tr><td>${esc(c.name)}</td><td class="${c.ok ? 'ok' : 'bad'}">${esc(c.actual)}</td><td>${esc(c.expected)}</td></tr>`).join('')}</table><p>${a(s.report, 'Quality report →')}</p>`,
};

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test Pipeline Dashboard</title>
<style>:root{--bg:#fff;--fg:#1d2433;--muted:#5d6678;--line:#e3e6ec;--card:#f8f9fb;--ok:#1a7f37;--bad:#cf222e;--skip:#8c959f;--accent:#4f6bed}
@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--fg:#e6e9ef;--muted:#9aa3b2;--line:#2a303b;--card:#161a22;--ok:#3fb950;--bad:#f85149;--skip:#6e7681;--accent:#7d93ff}}
*{box-sizing:border-box}body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0 auto;max-width:1200px;padding:24px 16px}
h1{margin:0;font-size:24px}.sub{color:var(--muted);margin:4px 0 20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--skip);border-radius:10px;padding:16px;overflow-x:auto}.card.passed{border-left-color:var(--ok)}.card.failed{border-left-color:var(--bad)}
.card header{display:flex;justify-content:space-between;align-items:center;gap:8px}.card h2{font-size:17px;margin:0}.pill{font-size:12px;font-weight:600;text-transform:uppercase;padding:2px 10px;border-radius:99px;background:var(--skip);color:#fff}
.passed .pill{background:var(--ok)}.failed .pill{background:var(--bad)}.owner{color:var(--muted);margin:4px 0}.owner span{font-style:italic}.headline{font-weight:600}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);white-space:nowrap}.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:600}a{color:var(--accent)}
.flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 20px;color:var(--muted)}.flow b{color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:6px;padding:2px 8px}</style></head><body>
<h1>${icon(overall)} Test-automation pipeline – ${esc(overall)}</h1>
<p class="sub">${esc(TEAM.project)} · generated ${new Date().toISOString()}${process.env.GITHUB_SHA ? ` · commit ${process.env.GITHUB_SHA.slice(0, 7)}` : ''}</p>
<div class="flow"><b>build</b>→<b>unit + coverage</b>→<b>quality gate</b> · <b>mutation</b> · <b>load + race</b>→<b>this report</b></div>
<div class="grid">${['unit', 'mutation', 'load', 'quality'].map(card).join('')}</div></body></html>`;
writeFileSync(join(ART, 'index.html'), html);

console.log(md);
console.log(`Dashboard: ${relative(ROOT, join(ART, 'index.html'))}`);
