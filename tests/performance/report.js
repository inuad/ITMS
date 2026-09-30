// Shared handleSummary output helpers for the TEST-03 k6 scenarios.
// Generates a self-contained HTML report (no external assets, no jslib import)
// plus a compact text summary for stdout logs. k6 1.3.0 has no --report-file,
// so handleSummary writes /reports/<scenario>_<timestamp>.html through the
// writable ./tests/performance/results mount in the Compose performance profile.

export function stamp(date) {
	const p = (n, w) => String(n).padStart(w || 2, "0");
	return (
		`${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
		`-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
	);
}

function human(ms) {
	if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
	if (ms >= 1) return `${ms.toFixed(2)}ms`;
	return `${(ms * 1000).toFixed(0)}µs`;
}

function num(v) {
	if (typeof v === "number") {
		return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
	}
	return String(v);
}

// Evaluate the user-agreed thresholds against the measured sub-metrics.
function thresholdRows(data, meta) {
	const dur = data.metrics["http_req_duration{scenario:default}"];
	const fail = data.metrics["http_req_failed{scenario:default}"];
	const checks = data.metrics.checks;
	return [
		{
			expression: "p(95)<" + meta.p95Ms,
			actual: dur
				? `p(95)=${human(dur.values["p(95)"])}`
				: "metric missing",
			pass: dur ? dur.values["p(95)"] < meta.p95Ms : false,
		},
		{
			expression: "rate<" + meta.failRate,
			actual: fail
				? `rate=${(fail.values.rate * 100).toFixed(2)}%`
				: "metric missing",
			pass: fail ? fail.values.rate < meta.failRate : false,
		},
		{
			expression: "checks:rate>" + meta.checkRate,
			actual: checks
				? `rate=${(checks.values.rate * 100).toFixed(2)}%`
				: "metric missing",
			pass: checks ? checks.values.rate > meta.checkRate : false,
		},
	];
}

export function textReport(data, meta) {
	const rows = thresholdRows(data, meta);
	const lines = [
		`k6 ${meta.scenarioName} scenario summary (handleSummary)`,
		`run: ${meta.startedAtUtc} .. ${meta.endedAtUtc} UTC (${meta.vus} VUs / ${meta.duration})`,
		`marker: ${meta.runId}  base: ${meta.baseUrl}`,
	];
	for (const r of rows) {
		lines.push(`${r.pass ? "✓" : "✗"} ${r.expression} — ${r.actual}`);
	}
	const it = data.metrics.iterations;
	const reqs = data.metrics.http_reqs;
	if (it) lines.push(`iterations: ${it.values.count}`);
	if (reqs)
		lines.push(
			`http_reqs: ${reqs.values.count} (${reqs.values.rate.toFixed(2)}/s)`,
		);
	const htmlPath = `/reports/k6-${meta.scenarioName}_${stamp(new Date())}.html`;
	lines.push(`html report: ${htmlPath}`);
	return lines.join("\n") + "\n";
}

function metricValue(m) {
	// Trend metrics all carry p(90)/p(95) keys and are durations in ms.
	const isDurationTrend = Object.prototype.hasOwnProperty.call(
		m.values,
		"p(90)",
	);
	return Object.entries(m.values)
		.map(([k, v]) => {
			if (k === "rate") {
				// rate-type metrics hold a 0..1 fraction; counters hold events/second.
				return m.type === "rate"
					? `rate=${(v * 100).toFixed(2)}%`
					: `rate=${v.toFixed(2)}/s`;
			}
			return `${k}=${isDurationTrend ? human(v) : num(v)}`;
		})
		.join(", ");
}

export function htmlReport(data, meta) {
	const rows = thresholdRows(data, meta);
	const allPass = rows.every((r) => r.pass);
	const metricsHtml = Object.entries(data.metrics)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(
			([name, m]) =>
				`<tr><td class="mono">${name}</td><td>${m.type}</td><td class="mono">${metricValue(m)}</td></tr>`,
		)
		.join("\n");
	const thresholdHtml = rows
		.map(
			(r) =>
				`<tr><td class="mono">${r.expression}</td><td class="mono">${r.actual}</td><td class="${
					r.pass ? "pass" : "fail"
				}">${r.pass ? "PASS" : "FAIL"}</td></tr>`,
		)
		.join("\n");
	const metaRows = [
		["Scenario", `k6 ${meta.scenarioName} (${meta.scriptFile})`],
		["Run window (UTC)", `${meta.startedAtUtc} .. ${meta.endedAtUtc}`],
		[
			"Load",
			`${meta.vus} VUs, ${meta.duration}, iteration pacing sleep ${meta.sleep}s`,
		],
		["Base URL", meta.baseUrl],
		["Fixture marker", meta.runId],
		[
			"Threshold targets (user-agreed)",
			`p95 &lt; ${meta.p95Ms} ms · failed &lt; ${meta.failRate * 100}% · checks &gt; ${meta.checkRate * 100}%`,
		],
		["k6", "grafana/k6:1.3.0 (Compose performance profile)"],
		[
			"Report written by",
			"handleSummary in script → /reports (tests/performance/results)",
		],
	]
		.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
		.join("\n");

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>k6 ${meta.scenarioName} report ${meta.endedAtUtc}</title>
<style>
:root { color-scheme: light; }
body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; margin: 2rem auto; max-width: 60rem; padding: 0 1rem; color: #1a1a1a; }
h1 { font-size: 1.4rem; }
.badge { display: inline-block; padding: .2rem .8rem; border-radius: 999px; font-weight: 700; }
.pass { color: #0a7d32; } .fail { color: #b3261e; }
.badge.pass { background: #dff5e3; } .badge.fail { background: #fde3e1; }
table { border-collapse: collapse; width: 100%; margin: 1rem 0 2rem; }
th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
th { background: #f7f7f8; }
.mono { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: .9em; }
section h2 { font-size: 1.05rem; margin-bottom: .3rem; }
td:nth-child(3) { white-space: pre-wrap; }
footer { color: #666; font-size: .85rem; margin-top: 2rem; }
</style>
</head>
<body>
<h1>k6 performance report — ${meta.scenarioName} scenario <span class="badge ${allPass ? "pass" : "fail"}">${allPass ? "THRESHOLDS PASSED" : "THRESHOLDS FAILED"}</span></h1>
<section>
<h2>Run metadata</h2>
<table>${metaRows}</table>
</section>
<section>
<h2>Thresholds (user-agreed targets)</h2>
<table><tr><th>Expression</th><th>Measured</th><th>Verdict</th></tr>${thresholdHtml}</table>
</section>
<section>
<h2>Metrics</h2>
<table><tr><th>Metric</th><th>Type</th><th>Values</th></tr>${metricsHtml}</table>
</section>
<footer>Generated by k6 handleSummary at end of test; summary data embedded above. Raw console logs with per-check breakdown are kept in docs/PHASE_3/task3-*.log.</footer>
</body>
</html>`;
}
