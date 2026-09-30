import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { createApi } from "../lib/api";
import { USERS, STATUSES, allowedActions } from "../lib/contract";

const employee = USERS[0];
beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-09-30T06:00:00Z"));
});
afterEach(() => vi.useRealTimers());

test("all identities and five statuses expose only permitted actions", () => {
	for (const user of USERS) {
		for (const status of STATUSES) {
			const row = { status, employeeEmail: user.email };
			const expected =
				user.role === "APPROVER"
					? status === "PENDING"
						? ["approve", "reject"]
						: []
					: status === "DRAFT"
						? ["edit", "submit", "cancel"]
						: status === "PENDING"
							? ["cancel"]
							: [];
			expect(allowedActions(user, row)).toEqual(expected);
		}
	}
	expect(
		allowedActions(USERS[1], {
			status: "DRAFT",
			employeeEmail: employee.email,
		}),
	).toEqual([]);
});

test("real transport sends both identity headers and exact bodies on all eight endpoints", async () => {
	vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", undefined);
	const fetchSpy = vi.fn().mockImplementation(async () => Response.json({}));
	vi.stubGlobal("fetch", fetchSpy);
	try {
		const api = createApi(employee);
		const input = {
			employeeName: employee.name,
			employeeEmail: employee.email,
			department: employee.department,
			title: "New equipment request",
			purpose: "Use for the next project",
			requiredDate: "2026-10-15",
			items: [],
		};
		await api.list();
		await api.detail("id");
		await api.create(input);
		await api.edit("id", { ...input, version: 4 });
		await api.submit("id", { version: 4 });
		await api.approve("id", { version: 4 });
		await api.reject("id", { version: 4, reason: "Reason" });
		await api.cancel("id", { version: 4 });
		expect(
			fetchSpy.mock.calls.map(([url, init]) => [
				new URL(url).pathname,
				init.method,
				init.body ? JSON.parse(init.body) : undefined,
			]),
		).toEqual([
			["/api/v1/equipment-requests", "GET", undefined],
			["/api/v1/equipment-requests/id", "GET", undefined],
			["/api/v1/equipment-requests", "POST", input],
			["/api/v1/equipment-requests/id", "PUT", { ...input, version: 4 }],
			["/api/v1/equipment-requests/id/submit", "POST", { version: 4 }],
			["/api/v1/equipment-requests/id/approve", "POST", { version: 4 }],
			[
				"/api/v1/equipment-requests/id/reject",
				"POST",
				{ version: 4, reason: "Reason" },
			],
			["/api/v1/equipment-requests/id/cancel", "POST", { version: 4 }],
		]);
		for (const [url] of fetchSpy.mock.calls)
			expect(new URL(url).origin).toBe("http://localhost:8080");
		for (const [, init] of fetchSpy.mock.calls)
			expect(init.headers).toMatchObject({
				"X-User-Role": "EMPLOYEE",
				"X-User-Email": "somchai@example.com",
			});
		vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8081///");
		const signal = new AbortController().signal;
		await createApi(employee).list({ keyword: "A & B", page: 2 }, signal);
		expect(fetchSpy.mock.lastCall?.[0]).toBe(
			"http://localhost:8081/api/v1/equipment-requests?keyword=A+%26+B&page=2",
		);
		expect(fetchSpy.mock.lastCall?.[1].signal).toBe(signal);
		fetchSpy.mockResolvedValueOnce(
			new Response("<html>Bad gateway</html>", { status: 502 }),
		);
		await expect(api.list()).rejects.toThrow(
			"ไม่สามารถอ่านคำตอบจากระบบได้ กรุณาลองใหม่",
		);
		fetchSpy.mockResolvedValueOnce(
			Response.json({ message: "invalid error shape" }, { status: 500 }),
		);
		await expect(api.list()).rejects.toThrow(
			"ระบบตอบกลับไม่สำเร็จ (500) กรุณาลองใหม่",
		);
	} finally {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
	}
});

test("validation honors length, integer, owner and Bangkok date boundaries", async () => {
	const { draftSchema, todayBangkok } = await import("../lib/validation");
	expect(todayBangkok(new Date("2026-09-29T17:00:00Z"))).toBe("2026-09-30");
	const schema = draftSchema(employee.email);
	const valid = {
		employeeName: "Ab",
		employeeEmail: employee.email,
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
		expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false);
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
