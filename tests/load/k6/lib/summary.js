// SE3112 – Load & Performance testing: self-contained reporting (no remote jslib imports,
// so the pipeline also works on locked-down runners). Produces console text, JSON, Markdown and HTML.

const OUT_DIR = __ENV.K6_OUT_DIR || 'results';

const fmt = (v, unit = 'ms') => (v === undefined || v === null ? '–' : `${Number(v).toFixed(unit === 'ms' ? 1 : 2)}${unit === 'ms' ? ' ms' : ''}`);

function thresholdRows(data) {
  const rows = [];
  for (const [metric, m] of Object.entries(data.metrics)) {
    for (const [expr, t] of Object.entries(m.thresholds || {})) rows.push({ metric, expr, ok: t.ok });
  }
  return rows.sort((a, b) => a.metric.localeCompare(b.metric));
}

function endpointRows(data) {
  const rows = [];
  for (const [name, m] of Object.entries(data.metrics)) {
    const match = name.match(/^http_req_duration\{endpoint:(.+)\}$/);
    if (match && m.values) rows.push({ endpoint: match[1], ...m.values });
  }
  return rows.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

function collectChecks(group, out = []) {
  for (const c of group.checks || []) out.push({ name: c.name, path: group.path, passes: c.passes, fails: c.fails });
  for (const g of group.groups || []) collectChecks(g, out);
  return out;
}

function headline(data) {
  const v = (name, key) => data.metrics[name]?.values?.[key];
  return {
    requests: v('http_reqs', 'count') || 0,
    rps: v('http_reqs', 'rate') || 0,
    failedRate: v('http_req_failed', 'rate') || 0,
    p95: v('http_req_duration', 'p(95)'),
    p99: v('http_req_duration', 'p(99)'),
    checksRate: v('checks', 'rate') || 0,
    vusMax: v('vus_max', 'max') || v('vus_max', 'value') || 0,
    iterations: v('iterations', 'count') || 0,
  };
}

function custom(data, names) {
  return names
    .filter((n) => data.metrics[n])
    .map((n) => ({ name: n, type: data.metrics[n].type, values: data.metrics[n].values }));
}

function text(title, data, customNames) {
  const h = headline(data);
  const lines = [
    '',
    `══ ${title} ══`,
    `requests ${h.requests} (${h.rps.toFixed(1)}/s) · failed ${(h.failedRate * 100).toFixed(2)}% · p95 ${fmt(h.p95)} · p99 ${fmt(h.p99)} · checks ${(h.checksRate * 100).toFixed(2)}% · max VUs ${h.vusMax}`,
    '',
    'endpoint                     count     avg       p90       p95       max',
  ];
  for (const r of endpointRows(data)) {
    lines.push(`${r.endpoint.padEnd(26)} ${String(data.metrics[`http_reqs{endpoint:${r.endpoint}}`]?.values?.count ?? '').padStart(7)} ${fmt(r.avg).padStart(9)} ${fmt(r['p(90)']).padStart(9)} ${fmt(r['p(95)']).padStart(9)} ${fmt(r.max).padStart(9)}`);
  }
  lines.push('', 'custom metrics:');
  for (const c of custom(data, customNames)) {
    const val = c.type === 'rate' ? `${(c.values.rate * 100).toFixed(2)}%` : c.type === 'counter' ? `${c.values.count}` : `p95 ${fmt(c.values['p(95)'])}`;
    lines.push(`  ${c.name.padEnd(30)} ${val}`);
  }
  lines.push('', 'thresholds:');
  for (const t of thresholdRows(data)) lines.push(`  ${t.ok ? '✓' : '✗'} ${t.metric} ${t.expr}`);
  const failedChecks = collectChecks(data.root_group).filter((c) => c.fails > 0);
  if (failedChecks.length) {
    lines.push('', 'failing checks:');
    for (const c of failedChecks) lines.push(`  ✗ ${c.name}: ${c.fails} of ${c.passes + c.fails} failed`);
  }
  lines.push('');
  return lines.join('\n');
}

function markdown(title, data, customNames) {
  const h = headline(data);
  const thresholds = thresholdRows(data);
  const passed = thresholds.every((t) => t.ok);
  let md = `### ${passed ? '✅' : '❌'} ${title}\n\n`;
  md += `| Requests | Throughput | Error rate | p95 | p99 | Checks | Max VUs |\n|---:|---:|---:|---:|---:|---:|---:|\n`;
  md += `| ${h.requests} | ${h.rps.toFixed(1)}/s | ${(h.failedRate * 100).toFixed(2)}% | ${fmt(h.p95)} | ${fmt(h.p99)} | ${(h.checksRate * 100).toFixed(2)}% | ${h.vusMax} |\n\n`;
  md += `| Endpoint | avg | p90 | p95 | max |\n|---|---:|---:|---:|---:|\n`;
  for (const r of endpointRows(data)) md += `| \`${r.endpoint}\` | ${fmt(r.avg)} | ${fmt(r['p(90)'])} | ${fmt(r['p(95)'])} | ${fmt(r.max)} |\n`;
  md += `\n| Threshold (SLO) | Result |\n|---|:---:|\n`;
  for (const t of thresholds) md += `| \`${t.metric}\` ${t.expr.replace(/\|/g, '\\|')} | ${t.ok ? '✅' : '❌'} |\n`;
  const cm = custom(data, customNames);
  if (cm.length) {
    md += `\n| Custom metric | Value |\n|---|---:|\n`;
    for (const c of cm) md += `| \`${c.name}\` | ${c.type === 'rate' ? `${(c.values.rate * 100).toFixed(2)}%` : c.type === 'counter' ? c.values.count : `p95 ${fmt(c.values['p(95)'])}`} |\n`;
  }
  return md;
}

function html(title, data, customNames) {
  const h = headline(data);
  const thresholds = thresholdRows(data);
  const passed = thresholds.every((t) => t.ok);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const endpoints = endpointRows(data);
  const maxP95 = Math.max(1, ...endpoints.map((r) => r['p(95)'] || 0));
  const checks = collectChecks(data.root_group);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
:root{--bg:#fff;--fg:#1d2433;--muted:#5d6678;--line:#e3e6ec;--ok:#1a7f37;--bad:#cf222e;--bar:#4f6bed;--card:#f6f8fa}
@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--fg:#e6e9ef;--muted:#9aa3b2;--line:#2a303b;--ok:#3fb950;--bad:#f85149;--bar:#7d93ff;--card:#171b23}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px;max-width:1100px;margin-inline:auto}
h1{font-size:22px;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 20px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.card b{display:block;font-size:20px}.card span{color:var(--muted);font-size:12px}
table{width:100%;border-collapse:collapse;margin:8px 0 24px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}td.n{text-align:right;font-variant-numeric:tabular-nums}
.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:600}.bar{height:8px;background:var(--bar);border-radius:4px}
.wrap{overflow-x:auto}</style></head><body>
<h1>${passed ? '✅' : '❌'} ${esc(title)}</h1><p class="sub">Generated ${new Date().toISOString()} · ${thresholds.filter((t) => t.ok).length}/${thresholds.length} thresholds passed</p>
<div class="cards">
<div class="card"><b>${h.requests}</b><span>HTTP requests</span></div>
<div class="card"><b>${h.rps.toFixed(1)}/s</b><span>throughput</span></div>
<div class="card"><b>${(h.failedRate * 100).toFixed(2)}%</b><span>error rate</span></div>
<div class="card"><b>${fmt(h.p95)}</b><span>p95 latency</span></div>
<div class="card"><b>${fmt(h.p99)}</b><span>p99 latency</span></div>
<div class="card"><b>${h.vusMax}</b><span>max virtual users</span></div>
</div>
<h2>Latency per endpoint</h2><div class="wrap"><table><tr><th>Endpoint</th><th>avg</th><th>p90</th><th>p95</th><th>max</th><th style="width:30%">p95</th></tr>
${endpoints.map((r) => `<tr><td><code>${esc(r.endpoint)}</code></td><td class="n">${fmt(r.avg)}</td><td class="n">${fmt(r['p(90)'])}</td><td class="n">${fmt(r['p(95)'])}</td><td class="n">${fmt(r.max)}</td><td><div class="bar" style="width:${(((r['p(95)'] || 0) / maxP95) * 100).toFixed(1)}%"></div></td></tr>`).join('')}
</table></div>
<h2>Thresholds (SLOs)</h2><div class="wrap"><table><tr><th>Metric</th><th>Condition</th><th>Result</th></tr>
${thresholds.map((t) => `<tr><td><code>${esc(t.metric)}</code></td><td><code>${esc(t.expr)}</code></td><td class="${t.ok ? 'ok' : 'bad'}">${t.ok ? 'PASS' : 'FAIL'}</td></tr>`).join('')}
</table></div>
<h2>Custom metrics</h2><div class="wrap"><table><tr><th>Metric</th><th>Type</th><th>Value</th></tr>
${custom(data, customNames).map((c) => `<tr><td><code>${esc(c.name)}</code></td><td>${c.type}</td><td class="n">${c.type === 'rate' ? `${(c.values.rate * 100).toFixed(2)}%` : c.type === 'counter' ? c.values.count : `avg ${fmt(c.values.avg)} · p95 ${fmt(c.values['p(95)'])}`}</td></tr>`).join('')}
</table></div>
<h2>Checks</h2><div class="wrap"><table><tr><th>Check</th><th>Passes</th><th>Fails</th></tr>
${checks.map((c) => `<tr><td>${esc(c.name)}</td><td class="n">${c.passes}</td><td class="n ${c.fails ? 'bad' : ''}">${c.fails}</td></tr>`).join('')}
</table></div></body></html>`;
}

/** Build the handleSummary() result for a test called `name`. */
export function buildSummary(name, title, data, customNames = []) {
  return {
    stdout: text(title, data, customNames),
    [`${OUT_DIR}/${name}-summary.json`]: JSON.stringify(data, null, 2),
    [`${OUT_DIR}/${name}-summary.md`]: markdown(title, data, customNames),
    [`${OUT_DIR}/${name}-report.html`]: html(title, data, customNames),
  };
}
