// TEST-03 write scenario: Create Draft -> Submit -> Approve
// Baseline: 10 VUs, 1 minute, p95 < 500 ms, failed requests < 1% (user-agreed targets).
// Every iteration drives its own request end to end with the versions returned by
// the API, so VUs never contend for the same aggregate (no synthetic 409s).
// Successful fixtures stay in the main DB per the main-DB agreement.

import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { htmlReport, stamp, textReport } from "./report.js";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(
	/\/+$/,
	"",
);
const API = `${BASE_URL}/api/v1/equipment-requests`;

const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || "1m";
const P95_MS = Number(__ENV.P95_MS || 500);
const FAIL_RATE = Number(__ENV.FAIL_RATE || 0.01);
const CHECK_RATE = Number(__ENV.CHECK_RATE || 0.99);
const SLEEP_S = Number(__ENV.SLEEP || 1);

const EMPLOYEE = {
	"X-User-Role": "EMPLOYEE",
	"X-User-Email": "somchai@example.com",
	"Content-Type": "application/json",
};
const APPROVER = {
	"X-User-Role": "APPROVER",
	"X-User-Email": "arun@example.com",
	"Content-Type": "application/json",
};

const RUN_ID = `K6WR-${new Date()
	.toISOString()
	.replace(/[-:TZ.]/g, "")
	.slice(0, 14)}`;

export const options = {
	vus: VUS,
	duration: DURATION,
	thresholds: {
		"http_req_failed{scenario:default}": [`rate<${FAIL_RATE}`],
		"http_req_duration{scenario:default}": [`p(95)<${P95_MS}`],
		checks: [`rate>${CHECK_RATE}`],
	},
};

function futureDate(days) {
	return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export function setup() {
	// Readiness probe outside measured time; aborts the run if backend is not serving.
	// No trailing slash before "?": ".../equipment-requests/" answers 404.
	const probe = http.get(`${API}?page=0&size=1`, { headers: APPROVER });
	if (probe.status !== 200) {
		throw new Error(
			`setup probe failed: HTTP ${probe.status} ${probe.body}`,
		);
	}
	const body = probe.json();
	console.log(
		JSON.stringify({
			event: "setup-complete",
			marker: RUN_ID,
			totalElementsAtStart: body.totalElements,
			baseUrl: BASE_URL,
		}),
	);
	return { marker: RUN_ID };
}

export default function (data) {
	const iteration = exec.scenario.iterationInTest;
	const unique = `${RUN_ID} V${__VU} I${iteration}`;

	// 1. Create Draft as the employee owner
	const created = http.post(
		API,
		JSON.stringify({
			employeeName: "Somchai Developer",
			employeeEmail: "somchai@example.com",
			department: "Software Engineering",
			title: `${unique} write workflow`,
			purpose: `k6 write-scenario full workflow fixture ${unique}`,
			requiredDate: futureDate(7),
			additionalNote: `k6 fixture marker ${RUN_ID}`,
			items: [
				{
					equipmentType: "NOTEBOOK",
					quantity: 1 + (iteration % 5),
					specification: `${unique}-item-1`,
				},
				...(iteration % 2 === 0
					? [
							{
								equipmentType: "HEADSET",
								quantity: 1,
								specification: `${unique}-item-2`,
							},
						]
					: []),
			],
		}),
		{ headers: EMPLOYEE, tags: { name: "create_draft" } },
	);
	const createdBody = created.json();
	const createOk = check(created, {
		"create draft: 201, DRAFT, version 0, server id/number": (r) =>
			r.status === 201 &&
			createdBody.status === "DRAFT" &&
			createdBody.version === 0 &&
			typeof createdBody.id === "string" &&
			typeof createdBody.requestNumber === "string",
	});
	if (!createOk || !createdBody.id) {
		sleep(SLEEP_S);
		return;
	}

	// 2. Submit with the version the API just returned
	const submitted = http.post(
		`${API}/${createdBody.id}/submit`,
		JSON.stringify({ version: createdBody.version }),
		{ headers: EMPLOYEE, tags: { name: "submit" } },
	);
	const submittedBody = submitted.json();
	const submitOk = check(submitted, {
		"submit: 200, PENDING, version incremented": (r) =>
			r.status === 200 &&
			submittedBody.status === "PENDING" &&
			submittedBody.version === createdBody.version + 1,
	});
	if (!submitOk) {
		sleep(SLEEP_S);
		return;
	}

	// 3. Approve as the approver identity
	const approved = http.post(
		`${API}/${createdBody.id}/approve`,
		JSON.stringify({ version: submittedBody.version }),
		{ headers: APPROVER, tags: { name: "approve" } },
	);
	const approvedBody = approved.json();
	check(approved, {
		"approve: 200, APPROVED terminal state": (r) =>
			r.status === 200 &&
			approvedBody.status === "APPROVED" &&
			approvedBody.version === submittedBody.version + 1,
	});

	sleep(SLEEP_S);
}

export function handleSummary(data) {
	const endedAt = new Date();
	// k6 re-evaluates script globals in the handleSummary context, so derive the
	// start from the measured run duration instead of a module-level new Date().
	const startedAt = new Date(
		endedAt.getTime() - (data.state?.testRunDurationMs || 0),
	);
	const meta = {
		scenarioName: "write",
		scriptFile: "write-scenario.js",
		startedAtUtc: startedAt.toISOString(),
		endedAtUtc: endedAt.toISOString(),
		vus: VUS,
		duration: DURATION,
		sleep: SLEEP_S,
		baseUrl: BASE_URL,
		runId: RUN_ID,
		p95Ms: P95_MS,
		failRate: FAIL_RATE,
		checkRate: CHECK_RATE,
	};
	return {
		stdout: textReport(data, meta),
		[`/reports/k6-write_${stamp(new Date())}.html`]: htmlReport(data, meta),
	};
}
