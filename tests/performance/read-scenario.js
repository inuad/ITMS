// TEST-03 read scenario: list / search / filter / pagination / detail
// Baseline: 10 VUs, 1 minute, p95 < 500 ms, failed requests < 1% (user-agreed targets).
// Configuration lives on the test side only; no frontend/backend source changes.
// Dataset is prepared in setup() through the real API (outside measured time)
// and kept as successful fixtures per the main-DB agreement.

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
const SETUP_EACH = Number(__ENV.SETUP_EACH || 8); // DRAFT/PENDING/APPROVED each
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

const RUN_ID = `K6RD-${new Date()
	.toISOString()
	.replace(/[-:TZ.]/g, "")
	.slice(0, 14)}`;
const STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];

// Thresholds are filtered to the measured scenario so setup() traffic
// (dataset preparation) is never part of the pass/fail numbers.
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

function draftPayload(seq) {
	return JSON.stringify({
		employeeName: "Somchai Developer",
		employeeEmail: "somchai@example.com",
		department: "Software Engineering",
		title: `${RUN_ID} read fixture ${String(seq).padStart(3, "0")}`,
		purpose: `k6 read-scenario dataset fixture ${RUN_ID} number ${seq} covering search filter pagination detail`,
		requiredDate: futureDate(7),
		additionalNote: `k6 fixture marker ${RUN_ID}`,
		items: [
			{
				equipmentType: "NOTEBOOK",
				quantity: 1 + (seq % 5),
				specification: `${RUN_ID}-item-${seq}`,
			},
			...(seq % 2 === 0
				? [
						{
							equipmentType: "MOUSE",
							quantity: 1,
							specification: `${RUN_ID}-item-${seq}-b`,
						},
					]
				: []),
		],
	});
}

function mustSucceed(res, step) {
	if (res.status < 200 || res.status >= 300) {
		throw new Error(`setup ${step} failed: HTTP ${res.status} ${res.body}`);
	}
	return res.json();
}

export function setup() {
	const ids = [];
	for (let seq = 0; seq < SETUP_EACH; seq++) {
		// DRAFT: create only
		const draft = mustSucceed(
			http.post(API, draftPayload(seq * 3), { headers: EMPLOYEE }),
			`create DRAFT ${seq}`,
		);
		ids.push(draft.id);

		// PENDING: create + submit
		const pending = mustSucceed(
			http.post(API, draftPayload(seq * 3 + 1), { headers: EMPLOYEE }),
			`create PENDING ${seq}`,
		);
		const submitted = mustSucceed(
			http.post(
				`${API}/${pending.id}/submit`,
				JSON.stringify({ version: pending.version }),
				{ headers: EMPLOYEE },
			),
			`submit ${seq}`,
		);
		if (submitted.status !== "PENDING") {
			throw new Error(
				`setup submit ${seq}: expected PENDING, got ${submitted.status}`,
			);
		}
		ids.push(pending.id);

		// APPROVED: create + submit + approve
		const approved = mustSucceed(
			http.post(API, draftPayload(seq * 3 + 2), { headers: EMPLOYEE }),
			`create APPROVED ${seq}`,
		);
		const submitted2 = mustSucceed(
			http.post(
				`${API}/${approved.id}/submit`,
				JSON.stringify({ version: approved.version }),
				{ headers: EMPLOYEE },
			),
			`submit ${seq} (approve path)`,
		);
		const final = mustSucceed(
			http.post(
				`${API}/${approved.id}/approve`,
				JSON.stringify({ version: submitted2.version }),
				{ headers: APPROVER },
			),
			`approve ${seq}`,
		);
		if (final.status !== "APPROVED") {
			throw new Error(
				`setup approve ${seq}: expected APPROVED, got ${final.status}`,
			);
		}
		ids.push(approved.id);
	}
	console.log(
		JSON.stringify({
			event: "setup-complete",
			marker: RUN_ID,
			createdRequests: ids.length,
			setupEach: SETUP_EACH,
			baseUrl: BASE_URL,
		}),
	);
	return { marker: RUN_ID, ids, expected: SETUP_EACH * 3 };
}

export default function (data) {
	const { marker, ids, expected } = data;
	// No trailing slash before "?": the API treats ".../equipment-requests/"
	// as a detail lookup with an empty id and answers 404 REQUEST_NOT_FOUND.
	const page = (params) => `${API}?${params}`;

	// 1. Default list
	const listDefault = http.get(page("page=0&size=10"), {
		headers: APPROVER,
		tags: { name: "list_default" },
	});
	const defaultBody = listDefault.json();
	check(listDefault, {
		"list default: 200 with page shape": (r) =>
			r.status === 200 &&
			Array.isArray(defaultBody.content) &&
			typeof defaultBody.totalElements === "number" &&
			defaultBody.content.length <= 10,
	});

	// 2. Keyword search on the setup marker
	const listKeyword = http.get(
		page(`keyword=${encodeURIComponent(marker)}`),
		{
			headers: APPROVER,
			tags: { name: "list_keyword" },
		},
	);
	const keywordBody = listKeyword.json();
	check(listKeyword, {
		"list keyword: 200, finds setup dataset, rows match marker": (r) =>
			r.status === 200 &&
			keywordBody.totalElements >= expected &&
			keywordBody.content.every((row) => row.title.includes(marker)),
	});

	// 3. Status filter
	const listStatus = http.get(page("status=PENDING&page=0&size=10"), {
		headers: APPROVER,
		tags: { name: "list_status" },
	});
	const statusBody = listStatus.json();
	check(listStatus, {
		"list status=PENDING: 200, rows all PENDING": (r) =>
			r.status === 200 &&
			statusBody.content.length > 0 &&
			statusBody.content.every((row) => row.status === "PENDING"),
	});

	// 4. Status + department combined filter
	const listFilter = http.get(
		page(
			`status=APPROVED&department=${encodeURIComponent("Software Engineering")}`,
		),
		{ headers: APPROVER, tags: { name: "list_status_department" } },
	);
	const filterBody = listFilter.json();
	check(listFilter, {
		"list status+department: 200, rows match both filters": (r) =>
			r.status === 200 &&
			filterBody.content.every(
				(row) =>
					row.status === "APPROVED" &&
					row.department === "Software Engineering",
			),
	});

	// 5. Pagination
	const listPage = http.get(page("page=1&size=5"), {
		headers: APPROVER,
		tags: { name: "list_page" },
	});
	const pageBody = listPage.json();
	check(listPage, {
		"list page=1 size=5: 200, page echoed, bounded content": (r) =>
			r.status === 200 &&
			pageBody.page === 1 &&
			pageBody.size === 5 &&
			pageBody.content.length > 0 &&
			pageBody.content.length <= 5,
	});

	// 6. Detail read as the owning employee (round-robin over setup ids)
	const id = ids[exec.scenario.iterationInTest % ids.length];
	const detail = http.get(`${API}/${id}`, {
		headers: EMPLOYEE,
		tags: { name: "detail_by_id" },
	});
	const detailBody = detail.json();
	check(detail, {
		"detail: 200, own request, full shape": (r) =>
			r.status === 200 &&
			detailBody.id === id &&
			STATUSES.includes(detailBody.status) &&
			typeof detailBody.version === "number" &&
			Array.isArray(detailBody.items) &&
			typeof detailBody.totalItems === "number",
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
		scenarioName: "read",
		scriptFile: "read-scenario.js",
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
		[`/reports/k6-read_${stamp(new Date())}.html`]: htmlReport(data, meta),
	};
}
