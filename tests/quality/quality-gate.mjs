#!/usr/bin/env node
// SE3112 – Code Quality & Metrics: quality gate.
//
// Turns raw tool output into SonarQube-style quality indicators and a pass/fail decision:
//   coverage        ← Cobertura XML merged by ReportGenerator (coverlet)
//   code smells     ← SARIF 2.1 logs from the Roslyn .NET analyzers + ESLint JSON
//   technical debt  ← Σ remediation minutes per finding (SQALE model, see quality-gate.config.json)
//   debt ratio      ← debt / (lines of code × minutes to develop one line)
//   ratings A–E     ← maintainability (debt ratio), security (unreviewed hotspots), reliability (errors)
//
// Usage: node tests/quality/quality-gate.mjs [--artifacts artifacts] [--no-fail]
// Writes artifacts/quality/quality-report.{json,md,html}; exits 1 when the gate fails.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const argValue = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const ARTIFACTS = resolve(ROOT, argValue('--artifacts', 'artifacts'));
const NO_FAIL = args.includes('--no-fail');
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'tests/quality/quality-gate.config.json'), 'utf8'));
const OUT = join(ARTIFACTS, 'quality');
mkdirSync(OUT, { recursive: true });

const toPosix = (p) => p.split(sep).join('/');
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// ── Coverage ────────────────────────────────────────────────────────────────────────────────
function readCoverage() {
  const file = join(ARTIFACTS, 'coverage/report/Cobertura.xml');
  if (!existsSync(file)) return null;
  const xml = readFileSync(file, 'utf8');
  const attr = (tag, name) => Number((tag.match(new RegExp(`${name}="([0-9.]+)"`)) || [])[1] || 0);
  const root = xml.match(/<coverage [^>]+>/)[0];
  const packages = [...xml.matchAll(/<package [^>]+>/g)].map(([tag]) => ({
    name: tag.match(/name="([^"]+)"/)[1],
    line: round(attr(tag, 'line-rate') * 100),
    branch: round(attr(tag, 'branch-rate') * 100),
  }));
  return {
    line: round(attr(root, 'line-rate') * 100),
    branch: round(attr(root, 'branch-rate') * 100),
    linesCovered: attr(root, 'lines-covered'),
    linesValid: attr(root, 'lines-valid'),
    packages,
  };
}

// ── Findings ────────────────────────────────────────────────────────────────────────────────
function remediation(rule) {
  const m = CONFIG.remediationMinutes;
  if (m[rule] !== undefined) return m[rule];
  if (rule?.startsWith('IDE')) return m.IDE;
  if (rule?.startsWith('CA')) return m.CA;
  return m.eslint;
}

function readSarif() {
  const dir = join(ARTIFACTS, 'quality/sarif');
  if (!existsSync(dir)) return [];
  const findings = [];
  const seen = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sarif'))) {
    const sarif = JSON.parse(readFileSync(join(dir, file), 'utf8').replace(/^﻿/, ''));
    for (const run of sarif.runs || []) {
      for (const r of run.results || []) {
        const level = r.level || 'warning';
        if (!['warning', 'error'].includes(level) || r.suppressions?.length) continue;
        const loc = r.locations?.[0]?.physicalLocation;
        const uri = decodeURIComponent((loc?.artifactLocation?.uri || '').replace(/^file:\/\//, ''));
        const path = uri ? toPosix(relative(ROOT, uri)) : file;
        const line = loc?.region?.startLine || 0;
        const key = `${r.ruleId}|${path}|${line}|${r.message?.text}`;
        if (seen.has(key)) continue; // multi-targeting / duplicate compiler passes
        seen.add(key);
        findings.push({ source: 'dotnet', rule: r.ruleId, level, path, line, message: r.message?.text || '' });
      }
    }
  }
  return findings;
}

function readEslint() {
  const file = join(ARTIFACTS, 'quality/eslint.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8')).flatMap((f) =>
    f.messages.map((m) => ({
      source: 'eslint',
      rule: m.ruleId || 'parse-error',
      level: m.severity === 2 ? 'error' : 'warning',
      path: toPosix(relative(ROOT, f.filePath)),
      line: m.line || 0,
      message: m.message.split('\n')[0],
    })),
  );
}

function hotspotReview(finding) {
  return CONFIG.reviewedHotspots.find(
    (h) => h.rule === finding.rule && finding.path.endsWith(h.file) && finding.message.includes(`'${h.member}'`),
  );
}

// ── Size ────────────────────────────────────────────────────────────────────────────────────
function countLoc(dir, exts, exclude) {
  let total = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (['node_modules', 'bin', 'obj', 'dist'].includes(name)) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (exts.some((e) => name.endsWith(e)) && !exclude.test(name)) {
        let inBlock = false;
        for (const raw of readFileSync(p, 'utf8').split('\n')) {
          const l = raw.trim();
          if (inBlock) { if (l.includes('*/')) inBlock = false; continue; }
          if (!l || l.startsWith('//')) continue;
          if (l.startsWith('/*')) { inBlock = !l.includes('*/'); continue; }
          total++;
        }
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return total;
}

// ── Evaluate ────────────────────────────────────────────────────────────────────────────────
const coverage = readCoverage();
const all = [...readSarif(), ...readEslint()];
const security = all.filter((f) => CONFIG.securityRules.includes(f.rule));
const reviewed = security.filter(hotspotReview).map((f) => ({ ...f, review: hotspotReview(f) }));
const unreviewed = security.filter((f) => !hotspotReview(f));
const smells = all.filter((f) => !CONFIG.securityRules.includes(f.rule));
const dotnetSmells = smells.filter((f) => f.source === 'dotnet');
const eslintProblems = all.filter((f) => f.source === 'eslint');
const eslintErrors = eslintProblems.filter((f) => f.level === 'error');
const analyzerErrors = dotnetSmells.filter((f) => f.level === 'error');

const loc = {
  backend: countLoc(join(ROOT, 'backend'), ['.cs'], /^$/),
  frontend: countLoc(join(ROOT, 'frontend/restaurant-web/src'), ['.js', '.jsx'], /\.test\.js$/),
};
loc.total = loc.backend + loc.frontend;

const debtMinutes = [...smells, ...unreviewed].reduce((sum, f) => sum + remediation(f.rule), 0);
const debtRatio = loc.total ? round((debtMinutes / (loc.total * CONFIG.minutesPerLineToDevelop)) * 100, 2) : 0;
const bands = CONFIG.ratingBands;
const maintainability = debtRatio <= bands.A ? 'A' : debtRatio <= bands.B ? 'B' : debtRatio <= bands.C ? 'C' : debtRatio <= bands.D ? 'D' : 'E';
const securityRating = unreviewed.length === 0 ? 'A' : 'E';
const reliabilityRating = analyzerErrors.length + eslintErrors.length === 0 ? 'A' : eslintErrors.length <= CONFIG.gate.ratchet.maxEslintErrors ? 'C' : 'D';
const ratingRank = (r) => 'ABCDE'.indexOf(r);

const byRule = Object.entries(
  smells.reduce((acc, f) => {
    const k = `${f.source}:${f.rule}`;
    acc[k] = acc[k] || { source: f.source, rule: f.rule, count: 0, minutes: 0, example: f.message };
    acc[k].count++;
    acc[k].minutes += remediation(f.rule);
    return acc;
  }, {}),
).map(([, v]) => v).sort((a, b) => b.minutes - a.minutes);

const byFile = Object.entries(
  smells.reduce((acc, f) => {
    acc[f.path] = (acc[f.path] || 0) + remediation(f.rule);
    return acc;
  }, {}),
).map(([path, minutes]) => ({ path, minutes })).sort((a, b) => b.minutes - a.minutes).slice(0, 10);

const g = CONFIG.gate;
const conditions = [
  { name: 'Line coverage', actual: coverage ? `${coverage.line}%` : 'n/a', expected: `≥ ${g.minLineCoverage}%`, ok: !!coverage && coverage.line >= g.minLineCoverage },
  { name: 'Branch coverage', actual: coverage ? `${coverage.branch}%` : 'n/a', expected: `≥ ${g.minBranchCoverage}%`, ok: !!coverage && coverage.branch >= g.minBranchCoverage },
  { name: 'Unreviewed security hotspots', actual: unreviewed.length, expected: `≤ ${g.maxUnreviewedSecurityHotspots}`, ok: unreviewed.length <= g.maxUnreviewedSecurityHotspots },
  { name: '.NET analyzer errors', actual: analyzerErrors.length, expected: `≤ ${g.maxAnalyzerErrors}`, ok: analyzerErrors.length <= g.maxAnalyzerErrors },
  { name: 'Maintainability rating', actual: `${maintainability} (${debtRatio}% debt ratio)`, expected: `≤ ${g.maxMaintainabilityRating}`, ok: ratingRank(maintainability) <= ratingRank(g.maxMaintainabilityRating) },
  { name: 'New .NET code smells (ratchet)', actual: dotnetSmells.length, expected: `≤ ${g.ratchet.maxDotnetCodeSmells}`, ok: dotnetSmells.length <= g.ratchet.maxDotnetCodeSmells },
  { name: 'New ESLint problems (ratchet)', actual: eslintProblems.length, expected: `≤ ${g.ratchet.maxEslintProblems}`, ok: eslintProblems.length <= g.ratchet.maxEslintProblems },
  { name: 'New ESLint errors (ratchet)', actual: eslintErrors.length, expected: `≤ ${g.ratchet.maxEslintErrors}`, ok: eslintErrors.length <= g.ratchet.maxEslintErrors },
];
const passed = conditions.every((c) => c.ok);

const report = {
  generatedAt: new Date().toISOString(),
  passed,
  conditions,
  metrics: {
    coverage,
    linesOfCode: loc,
    codeSmells: { total: smells.length, dotnet: dotnetSmells.length, eslint: eslintProblems.length, eslintErrors: eslintErrors.length },
    technicalDebt: { minutes: debtMinutes, readable: `${Math.floor(debtMinutes / 480)}d ${Math.floor((debtMinutes % 480) / 60)}h ${debtMinutes % 60}min`, ratioPercent: debtRatio },
    ratings: { maintainability, security: securityRating, reliability: reliabilityRating },
    securityHotspots: { total: security.length, reviewed: reviewed.length, unreviewed: unreviewed.length },
  },
  byRule,
  topFilesByDebt: byFile,
  reviewedHotspots: reviewed.map((f) => ({ rule: f.rule, path: f.path, line: f.line, justification: f.review.justification })),
  unreviewedHotspots: unreviewed,
};

// ── Render ──────────────────────────────────────────────────────────────────────────────────
const m = report.metrics;
let md = `### ${passed ? '✅ Quality gate passed' : '❌ Quality gate failed'}\n\n`;
md += `| Coverage (line / branch) | Code smells | Technical debt | Debt ratio | Maintainability | Security | Reliability | LOC |\n|---|---:|---:|---:|:---:|:---:|:---:|---:|\n`;
md += `| ${coverage ? `${coverage.line}% / ${coverage.branch}%` : 'n/a'} | ${m.codeSmells.total} | ${m.technicalDebt.readable} | ${debtRatio}% | **${maintainability}** | **${securityRating}** | **${reliabilityRating}** | ${loc.total} |\n\n`;
md += `| Condition | Actual | Required | |\n|---|---:|---:|:---:|\n`;
for (const c of conditions) md += `| ${c.name} | ${c.actual} | ${c.expected} | ${c.ok ? '✅' : '❌'} |\n`;
md += `\n<details><summary>Debt by rule (top 12)</summary>\n\n| Source | Rule | Count | Debt (min) | Example |\n|---|---|---:|---:|---|\n`;
for (const r of byRule.slice(0, 12)) md += `| ${r.source} | \`${r.rule}\` | ${r.count} | ${r.minutes} | ${r.example.replace(/\|/g, '\\|').slice(0, 90)} |\n`;
md += `\n</details>\n`;
if (reviewed.length) md += `\nReviewed security hotspots: ${reviewed.length} (marked SAFE with justification in \`tests/quality/quality-gate.config.json\`).\n`;
for (const u of unreviewed) md += `\n> ❌ **Unreviewed hotspot** \`${u.rule}\` ${u.path}:${u.line} – ${u.message}\n`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const badge = (r) => `<span class="rating r${r}">${r}</span>`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quality Gate</title>
<style>:root{--bg:#fff;--fg:#1d2433;--muted:#5d6678;--line:#e3e6ec;--card:#f6f8fa;--ok:#1a7f37;--bad:#cf222e}
@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--fg:#e6e9ef;--muted:#9aa3b2;--line:#2a303b;--card:#171b23;--ok:#3fb950;--bad:#f85149}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:24px 16px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0 24px}.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.card b{display:block;font-size:22px}.card span{color:var(--muted);font-size:12px}
.rating{display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;color:#fff;font-weight:700}.rA{background:#1a7f37}.rB{background:#5a9e1b}.rC{background:#bf8700}.rD{background:#d1580f}.rE{background:#cf222e}
table{width:100%;border-collapse:collapse;margin:8px 0 24px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}td.n{text-align:right}.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:600}.wrap{overflow-x:auto}</style></head><body>
<h1>${passed ? '✅ Quality gate passed' : '❌ Quality gate failed'}</h1><p style="color:var(--muted)">Generated ${report.generatedAt}</p>
<div class="cards">
<div class="card"><b>${coverage ? coverage.line : 'n/a'}%</b><span>line coverage (branch ${coverage ? coverage.branch : 'n/a'}%)</span></div>
<div class="card"><b>${m.codeSmells.total}</b><span>code smells (.NET ${m.codeSmells.dotnet} · ESLint ${m.codeSmells.eslint})</span></div>
<div class="card"><b>${m.technicalDebt.readable}</b><span>technical debt · ratio ${debtRatio}%</span></div>
<div class="card"><b>${badge(maintainability)}</b><span>maintainability</span></div>
<div class="card"><b>${badge(securityRating)}</b><span>security (${reviewed.length} hotspots reviewed)</span></div>
<div class="card"><b>${badge(reliabilityRating)}</b><span>reliability</span></div>
<div class="card"><b>${loc.total}</b><span>lines of code (.NET ${loc.backend} · JS ${loc.frontend})</span></div>
</div>
<h2>Gate conditions</h2><div class="wrap"><table><tr><th>Condition</th><th>Actual</th><th>Required</th><th>Status</th></tr>
${conditions.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.actual)}</td><td>${esc(c.expected)}</td><td class="${c.ok ? 'ok' : 'bad'}">${c.ok ? 'PASS' : 'FAIL'}</td></tr>`).join('')}</table></div>
<h2>Coverage by service</h2><div class="wrap"><table><tr><th>Assembly</th><th>Line</th><th>Branch</th></tr>
${(coverage?.packages || []).map((p) => `<tr><td>${esc(p.name)}</td><td class="n">${p.line}%</td><td class="n">${p.branch}%</td></tr>`).join('')}</table></div>
<h2>Technical debt by rule</h2><div class="wrap"><table><tr><th>Source</th><th>Rule</th><th>Count</th><th>Debt (min)</th><th>Example</th></tr>
${byRule.map((r) => `<tr><td>${r.source}</td><td><code>${esc(r.rule)}</code></td><td class="n">${r.count}</td><td class="n">${r.minutes}</td><td>${esc(r.example.slice(0, 140))}</td></tr>`).join('')}</table></div>
<h2>Files with the most debt</h2><div class="wrap"><table><tr><th>File</th><th>Debt (min)</th></tr>
${byFile.map((f) => `<tr><td><code>${esc(f.path)}</code></td><td class="n">${f.minutes}</td></tr>`).join('')}</table></div>
<h2>Security hotspots</h2><div class="wrap"><table><tr><th>Rule</th><th>Location</th><th>Status</th><th>Justification</th></tr>
${reviewed.map((h) => `<tr><td><code>${h.rule}</code></td><td>${esc(h.path)}:${h.line}</td><td class="ok">SAFE</td><td>${esc(h.review.justification)}</td></tr>`).join('')}
${unreviewed.map((h) => `<tr><td><code>${h.rule}</code></td><td>${esc(h.path)}:${h.line}</td><td class="bad">TO REVIEW</td><td>${esc(h.message)}</td></tr>`).join('')}</table></div>
</body></html>`;

writeFileSync(join(OUT, 'quality-report.json'), JSON.stringify(report, null, 2));
writeFileSync(join(OUT, 'quality-report.md'), md);
writeFileSync(join(OUT, 'quality-report.html'), html);

console.log(`\nQuality gate: ${passed ? 'PASSED' : 'FAILED'}`);
console.log(`  coverage        ${coverage ? `${coverage.line}% line / ${coverage.branch}% branch` : 'n/a'}`);
console.log(`  code smells     ${smells.length} (.NET ${dotnetSmells.length}, ESLint ${eslintProblems.length} incl. ${eslintErrors.length} errors)`);
console.log(`  technical debt  ${m.technicalDebt.readable} (ratio ${debtRatio}% of ${loc.total} LOC)`);
console.log(`  ratings         maintainability ${maintainability} · security ${securityRating} · reliability ${reliabilityRating}`);
console.log(`  hotspots        ${reviewed.length} reviewed, ${unreviewed.length} to review`);
for (const c of conditions) console.log(`  ${c.ok ? '✓' : '✗'} ${c.name.padEnd(32)} ${String(c.actual).padStart(22)}  (required ${c.expected})`);
console.log(`\nReport: ${toPosix(relative(ROOT, join(OUT, 'quality-report.html')))}`);
process.exit(passed || NO_FAIL ? 0 : 1);
