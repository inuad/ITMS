// @vitest-environment jsdom
import React from "react";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
	vi,
} from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Home from "../app/page";
import {
	USERS,
	type RequestDetail,
	type RequestRow,
	type Page,
	type ApiErrorBody,
} from "../lib/contract";

// HTTP response samples for UI tests only; no backend rules or storage simulation.
const draft: RequestDetail = {
	id: "10000000-0000-4000-8000-000000000001",
	requestNumber: "REQ-2026-000001",
	employeeName: USERS[0].name,
	employeeEmail: USERS[0].email,
	department: USERS[0].department,
	title: "Notebook for project",
	purpose: "Use for the next project",
	requiredDate: "2026-10-15",
	status: "DRAFT",
	version: 0,
	totalItems: 0,
	items: [],
	additionalNote: null,
	rejectionReason: null,
	createdAt: "2026-09-30T06:00:00Z",
	updatedAt: "2026-09-30T06:00:00Z",
};
const pending: RequestDetail = {
	...draft,
	id: "10000000-0000-4000-8000-000000000002",
	requestNumber: "REQ-2026-000002",
	status: "PENDING",
	version: 2,
};
function page(
	content: RequestRow[],
	patch: Partial<Page<RequestRow>> = {},
): Page<RequestRow> {
	return {
		content,
		page: 0,
		size: 10,
		totalElements: content.length,
		totalPages: 1,
		...patch,
	};
}
function errorResponse(
	status: number,
	code: string,
	fieldErrors: ApiErrorBody["fieldErrors"] = {},
) {
	return Response.json(
		{
			timestamp: "2026-09-30T06:00:00Z",
			status,
			code,
			message: "Request failed",
			path: "/api/v1/equipment-requests",
			fieldErrors,
		},
		{ status },
	);
}
const fetchSpy = vi.fn<typeof fetch>();
beforeEach(() => {
	fetchSpy
		.mockReset()
		.mockImplementation(async (url) =>
			Response.json(
				String(url).includes(draft.id) ? draft : page([draft, pending]),
			),
		);
	vi.stubGlobal("fetch", fetchSpy);
	window.history.replaceState(null, "", "/");
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-09-30T06:00:00Z"));
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
beforeAll(() => {
	HTMLDialogElement.prototype.showModal = function () {
		this.open = true;
	};
	HTMLDialogElement.prototype.close = function () {
		this.open = false;
	};
});

// ── Helpers ──────────────────────────────────────────────────────────

async function loginEmployee() {
	render(<Home />);
	fireEvent.change(screen.getByLabelText("2. ผู้ใช้งาน"), {
		target: { value: "somchai@example.com" },
	});
	fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
	await screen.findByRole("button", { name: "สร้างคำขอ" });
	await screen.findByRole("button", { name: "ดูรายละเอียด REQ-2026-000001" });
}
function fillDraft() {
	fireEvent.change(screen.getByLabelText("ชื่อเรื่อง"), {
		target: { value: "New notebook request" },
	});
	fireEvent.change(screen.getByLabelText("วัตถุประสงค์"), {
		target: { value: "Use for the upcoming software project" },
	});
	fireEvent.change(screen.getByLabelText("วันที่ต้องการใช้งาน"), {
		target: { value: "2026-10-15" },
	});
}

// ── Scenario 1: Required fields ไม่ครบแสดง error ─────────────────────

describe("Scenario 1 — Required fields ไม่ครบแสดง error", () => {
	test("draft form validates required fields and binds the selected owner", async () => {
		render(<Home />);
		fireEvent.change(screen.getByLabelText("2. ผู้ใช้งาน"), {
			target: { value: "somchai@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
		fireEvent.click(
			await screen.findByRole("button", { name: "สร้างคำขอ" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "บันทึก Draft" }));
		expect(
			await screen.findByText("ชื่อเรื่องต้องมี 5–150 ตัวอักษร"),
		).toBeTruthy();
		expect(
			screen.getByText("วัตถุประสงค์ต้องมี 10–500 ตัวอักษร"),
		).toBeTruthy();
		expect(
			(screen.getByLabelText("Email ผู้ขอ") as HTMLInputElement).readOnly,
		).toBe(true);
		expect(
			(screen.getByLabelText("Email ผู้ขอ") as HTMLInputElement).value,
		).toBe("somchai@example.com");
	});

	test("validation schema honors length boundaries and Bangkok date", async () => {
		const { draftSchema, todayBangkok } = await import("../lib/validation");
		expect(todayBangkok(new Date("2026-09-29T17:00:00Z"))).toBe(
			"2026-09-30",
		);
		const schema = draftSchema(USERS[0].email);
		const valid = {
			employeeName: "Ab",
			employeeEmail: USERS[0].email,
			department: "IT",
			title: "Title",
			purpose: "0123456789",
			requiredDate: "2026-09-30",
			additionalNote: "",
			items: [],
		};
		expect(schema.safeParse(valid).success).toBe(true);
		for (const patch of [
			{ employeeName: "A" },
			{ employeeName: "A".repeat(101) },
			{ employeeEmail: "bad" },
			{ employeeEmail: "suda@example.com" },
			{ department: "   " },
			{ title: "abcd" },
			{ title: "a".repeat(151) },
			{ purpose: "short" },
			{ purpose: "a".repeat(501) },
			{ requiredDate: "2026-09-29" },
			{ requiredDate: "2026-02-30" },
			{ additionalNote: "a".repeat(501) },
			...[0, 6, 1.5].map((quantity) => ({
				items: [{ equipmentType: "NOTEBOOK", quantity }],
			})),
			{ items: [{ equipmentType: "INVALID", quantity: 1 }] },
			{
				items: [
					{
						equipmentType: "NOTEBOOK",
						quantity: 1,
						specification: "a".repeat(251),
					},
				],
			},
		])
			expect(schema.safeParse({ ...valid, ...patch }).success).toBe(
				false,
			);
		expect(
			schema.safeParse({
				...valid,
				employeeName: "a".repeat(100),
				title: "a".repeat(150),
				purpose: "a".repeat(500),
				additionalNote: "a".repeat(500),
				items: [
					{
						equipmentType: "NOTEBOOK",
						quantity: 5,
						specification: "a".repeat(250),
					},
				],
			}).success,
		).toBe(true);
	});
});

// ── Scenario 2: เพิ่ม/ลบ Equipment Item ──────────────────────────────

describe("Scenario 2 — เพิ่มและลบ Equipment Item", () => {
	test("dynamic equipment validates quantity and saves an empty draft with a reset form", async () => {
		await loginEmployee();
		fireEvent.click(screen.getByRole("button", { name: "สร้างคำขอ" }));
		fillDraft();
		fireEvent.click(screen.getByRole("button", { name: "เพิ่มอุปกรณ์" }));
		fireEvent.click(screen.getByRole("button", { name: "เพิ่มอุปกรณ์" }));
		for (const label of ["ประเภทอุปกรณ์", "จำนวน", "Specification"])
			expect(screen.getAllByLabelText(label)).toHaveLength(2);
		fireEvent.click(screen.getByRole("button", { name: "ลบอุปกรณ์ 2" }));
		fireEvent.change(screen.getByLabelText("จำนวน"), {
			target: { value: "6" },
		});
		fireEvent.click(screen.getByRole("button", { name: "บันทึก Draft" }));
		await screen.findByText("จำนวนต้องอยู่ระหว่าง 1–5");
		fireEvent.click(screen.getByRole("button", { name: "ลบอุปกรณ์ 1" }));
		const saved = {
			...draft,
			id: "10000000-0000-4000-8000-000000000003",
			requestNumber: "REQ-2026-000003",
			title: "New notebook request",
		};
		fetchSpy.mockImplementation(async (_url, init) =>
			Response.json(
				init?.method === "POST" ? saved : page([draft, pending, saved]),
			),
		);
		expect(screen.queryByLabelText("จำนวน")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "บันทึก Draft" }));
		const { waitFor } = await import("@testing-library/react");
		await waitFor(() =>
			expect(
				(screen.getByLabelText("ชื่อเรื่อง") as HTMLInputElement).value,
			).toBe(""),
		);
		await screen.findByText("3 คำขอ");
		expect(
			(screen.getByLabelText("Email ผู้ขอ") as HTMLInputElement).value,
		).toBe("somchai@example.com");
		expect(screen.getByText("ข้อมูลยังไม่มีการเปลี่ยนแปลง")).toBeTruthy();
	});
});

// ── Scenario 3: ป้องกัน Submit ซ้ำระหว่าง loading ───────────────────

describe("Scenario 3 — ป้องกัน Submit ซ้ำระหว่าง loading", () => {
	test("loading prevents duplicate writes and keeps controls disabled until completion", async () => {
		let finish!: (response: Response) => void;
		const writing = new Promise<Response>((resolve) => {
			finish = resolve;
		});
		fetchSpy.mockImplementation(async (_url, init) =>
			init?.method === "POST"
				? writing
				: Response.json(page([draft, pending])),
		);
		await loginEmployee();
		fireEvent.click(screen.getByRole("button", { name: "สร้างคำขอ" }));
		fillDraft();
		const button = screen.getByRole("button", { name: "บันทึก Draft" });
		fireEvent.click(button);
		fireEvent.click(button);
		const pendingButton = await screen.findByRole("button", {
			name: "กำลังบันทึก…",
		});
		expect((pendingButton as HTMLButtonElement).disabled).toBe(true);
		expect(
			(
				screen.getByRole("button", {
					name: "ปิดฟอร์ม",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);
		expect(
			fetchSpy.mock.calls.filter(([, init]) => init?.method === "POST"),
		).toHaveLength(1);
		finish(Response.json(draft));
		await screen.findByRole("button", { name: "บันทึก Draft" });
		expect(
			fetchSpy.mock.calls.filter(([, init]) => init?.method === "POST"),
		).toHaveLength(1);
	});
});

// ── Scenario 4: Server fieldErrors map ไป field ──────────────────────

describe("Scenario 4 — Server fieldErrors map ไป field", () => {
	test("server field errors map to fields without clearing the entered values", async () => {
		await loginEmployee();
		fireEvent.click(screen.getByRole("button", { name: "สร้างคำขอ" }));
		fillDraft();
		fetchSpy.mockResolvedValueOnce(
			errorResponse(400, "VALIDATION_ERROR", {
				employeeEmail: "Email format is invalid",
				requiredDate: "Required date must not be in the past",
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "บันทึก Draft" }));
		await screen.findByText("Email format is invalid");
		expect(
			screen.getByText("Required date must not be in the past"),
		).toBeTruthy();
		expect(
			(screen.getByLabelText("ชื่อเรื่อง") as HTMLInputElement).value,
		).toBe("New notebook request");
		expect(
			(
				screen.getByRole("textbox", {
					name: /Email ผู้ขอ/,
				}) as HTMLInputElement
			).value,
		).toBe("somchai@example.com");
	});
});

// ── Scenario 5: Success อัปเดตรายการ/reset form ตาม mode ─────────────

describe("Scenario 5 — Success อัปเดตรายการและ reset form ตาม mode", () => {
	test("approver approves a pending request using its version and refreshes the list", async () => {
		const approved = {
			...pending,
			status: "APPROVED" as const,
			version: 3,
		};
		let listResponse = page([pending]);
		fetchSpy.mockImplementation(async (_url, init) => {
			if (init?.method === "POST") {
				expect(JSON.parse(String(init.body))).toEqual({ version: 2 });
				listResponse = page([approved]);
				return Response.json(approved);
			}
			return Response.json(listResponse);
		});
		render(<Home />);
		fireEvent.click(
			screen.getByRole("radio", { name: "Approver ตรวจคำขอทั้งหมด" }),
		);
		fireEvent.change(screen.getByLabelText("2. ผู้ใช้งาน"), {
			target: { value: "arun@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
		const view = await screen.findByRole("button", {
			name: "ดูรายละเอียด REQ-2026-000002",
		});
		const { within } = await import("@testing-library/react");
		fireEvent.click(
			within(view.closest("tr")!).getByRole("button", {
				name: "อนุมัติ",
			}),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: "ยืนยันอนุมัติ" }),
		);
		await screen.findByText("ทำรายการ REQ-2026-000002 สำเร็จ");
		const updatedView = await screen.findByRole("button", {
			name: "ดูรายละเอียด REQ-2026-000002",
		});
		expect(
			within(updatedView.closest("tr")!).getByText("อนุมัติแล้ว"),
		).toBeTruthy();
	});

	test("create success resets form to blank and updates list count", async () => {
		await loginEmployee();
		fireEvent.click(screen.getByRole("button", { name: "สร้างคำขอ" }));
		fillDraft();
		const saved = {
			...draft,
			id: "10000000-0000-4000-8000-000000000004",
			requestNumber: "REQ-2026-000004",
			title: "New notebook request",
		};
		fetchSpy.mockImplementation(async (_url, init) =>
			Response.json(
				init?.method === "POST" ? saved : page([draft, pending, saved]),
			),
		);
		fireEvent.click(screen.getByRole("button", { name: "บันทึก Draft" }));
		const { waitFor } = await import("@testing-library/react");
		await waitFor(() =>
			expect(
				(screen.getByLabelText("ชื่อเรื่อง") as HTMLInputElement).value,
			).toBe(""),
		);
		await screen.findByText("3 คำขอ");
		expect(screen.getByText("ข้อมูลยังไม่มีการเปลี่ยนแปลง")).toBeTruthy();
	});
});

// ── Scenario 6: Search + Filters ทำงานร่วมกัน ────────────────────────

describe("Scenario 6 — Search และ filters ทำงานร่วมกัน", () => {
	test("search restores pagination within a session and resets all list controls when switching users", async () => {
		fetchSpy.mockImplementation(async (url) => {
			const params = new URL(String(url)).searchParams;
			return Response.json(
				params.get("page") === "1"
					? page([draft, pending], {
							page: 1,
							size: 2,
							totalElements: 10,
							totalPages: 5,
						})
					: page(params.has("status") ? [pending] : [draft, pending]),
			);
		});
		render(<Home />);
		fireEvent.click(
			screen.getByRole("radio", { name: "Approver ตรวจคำขอทั้งหมด" }),
		);
		fireEvent.change(screen.getByLabelText("2. ผู้ใช้งาน"), {
			target: { value: "arun@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
		fireEvent.change(await screen.findByLabelText("ค้นหาคำขอ"), {
			target: { value: "Somchai" },
		});
		fireEvent.click(screen.getByRole("button", { name: "ค้นหา" }));
		fireEvent.change(screen.getByLabelText("กรองสถานะ"), {
			target: { value: "PENDING" },
		});
		fireEvent.change(screen.getByLabelText("กรองแผนก"), {
			target: { value: "Software Engineering" },
		});
		await screen.findByText("1 คำขอ");
		const params = new URLSearchParams(window.location.search);
		expect(params.get("keyword")).toBe("Somchai");
		expect(params.get("status")).toBe("PENDING");
		expect(params.get("department")).toBe("Software Engineering");
		expect(params.get("page")).toBe("0");
		const sent = new URL(String(fetchSpy.mock.calls.at(-1)![0]))
			.searchParams;
		expect(Object.fromEntries(sent)).toMatchObject({
			keyword: "Somchai",
			status: "PENDING",
			department: "Software Engineering",
			page: "0",
		});
		expect(
			screen.queryByRole("button", {
				name: "ดูรายละเอียด REQ-2026-000007",
			}),
		).toBeNull();
		window.history.pushState(
			null,
			"",
			"/?page=1&size=2&sort=createdAt,asc",
		);
		fireEvent.popState(window);
		await screen.findByText("หน้า 2 / 5");
		expect(
			(screen.getByLabelText("จำนวนต่อหน้า") as HTMLSelectElement).value,
		).toBe("2");
		fireEvent.change(screen.getByLabelText("กรองสถานะ"), {
			target: { value: "PENDING" },
		});
		fireEvent.change(screen.getByLabelText("กรองแผนก"), {
			target: { value: "Software Engineering" },
		});
		window.history.pushState(
			null,
			"",
			"/?keyword=Somchai&status=PENDING&department=Software%20Engineering&page=1&size=2&sort=createdAt,asc#requests",
		);
		fireEvent.popState(window);
		await screen.findByText("หน้า 2 / 5");
		fireEvent.click(screen.getByRole("button", { name: "เปลี่ยนผู้ใช้" }));
		expect(
			screen.getByRole("button", { name: "เข้าสู่ระบบ" }),
		).toBeTruthy();
		expect(window.location.search).toBe("");
		expect(window.location.hash).toBe("#requests");
		fireEvent.change(screen.getByLabelText("2. ผู้ใช้งาน"), {
			target: { value: "suda@example.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
		await screen.findByText("2 คำขอ");
		for (const label of ["ค้นหาคำขอ", "กรองสถานะ", "กรองแผนก"])
			expect(
				(screen.getByLabelText(label) as HTMLInputElement).value,
			).toBe("");
		expect(
			(screen.getByLabelText("จำนวนต่อหน้า") as HTMLSelectElement).value,
		).toBe("10");
		expect(
			(screen.getByLabelText("เรียงวันที่สร้าง") as HTMLSelectElement)
				.value,
		).toBe("createdAt,desc");
		const [url, init] = fetchSpy.mock.calls.at(-1)!;
		expect(Object.fromEntries(new URL(String(url)).searchParams)).toEqual({
			keyword: "",
			department: "",
			page: "0",
			size: "10",
			sort: "createdAt,desc",
		});
		expect(init?.headers).toMatchObject({
			"X-User-Role": "EMPLOYEE",
			"X-User-Email": "suda@example.com",
		});
	});
});

// ── Scenario 7: Version conflict ─────────────────────────────────────

describe("Scenario 7 — Version conflict แจ้งผู้ใช้/คง form/no automatic overwrite", () => {
	test("conflict preserves edits; reload and dirty close need an explicit discard choice", async () => {
		const { within, waitFor } = await import("@testing-library/react");

		const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
		await loginEmployee();
		const view = await screen.findByRole("button", {
			name: "ดูรายละเอียด REQ-2026-000001",
		});
		fireEvent.click(
			within(view.closest("tr")!).getByRole("button", { name: "แก้ไข" }),
		);
		const title = await screen.findByLabelText("ชื่อเรื่อง");
		fireEvent.change(title, {
			target: { value: "My unsaved changes" },
		});
		const latest = {
			...draft,
			title: "Other user saved this",
			version: 1,
		};
		fetchSpy.mockImplementation(async (url, init) =>
			init?.method === "PUT"
				? errorResponse(409, "REQUEST_VERSION_CONFLICT")
				: Response.json(
						String(url).includes(draft.id)
							? latest
							: page([latest, pending]),
					),
		);
		fireEvent.click(screen.getByRole("button", { name: "บันทึก Draft" }));
		await screen.findByText(
			"ข้อมูลที่กรอกยังอยู่ กรุณาเลือกโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง",
		);
		expect((title as HTMLInputElement).value).toBe("My unsaved changes");
		fireEvent.click(
			screen.getByRole("button", {
				name: "โหลดล่าสุดและแทนค่าที่กรอก",
			}),
		);
		expect(confirm).toHaveBeenCalled();
		expect((title as HTMLInputElement).value).toBe("My unsaved changes");
		confirm.mockReturnValue(true);
		fireEvent.click(
			screen.getByRole("button", {
				name: "โหลดล่าสุดและแทนค่าที่กรอก",
			}),
		);
		await waitFor(() =>
			expect((title as HTMLInputElement).value).toBe(
				"Other user saved this",
			),
		);
		fireEvent.change(title, {
			target: { value: "My saved revision" },
		});
		const event = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		confirm.mockReturnValue(false);
		fireEvent.click(screen.getByRole("button", { name: "ปิดฟอร์ม" }));
		expect(screen.getByRole("dialog")).toBeTruthy();
		const saved = { ...latest, title: "My saved revision", version: 2 };
		fetchSpy.mockImplementation(async (_url, init) => {
			if (init?.method === "PUT") {
				expect(JSON.parse(String(init.body))).toMatchObject({
					title: saved.title,
					version: 1,
				});
				return Response.json(saved);
			}
			return Response.json(page([saved, pending]));
		});
		fireEvent.click(screen.getByRole("button", { name: "บันทึก Draft" }));
		await screen.findByText("ข้อมูลยังไม่มีการเปลี่ยนแปลง");
		await screen.findByText("My saved revision");
		const cleanEvent = new Event("beforeunload", { cancelable: true });
		window.dispatchEvent(cleanEvent);
		expect(cleanEvent.defaultPrevented).toBe(false);
	});
});
