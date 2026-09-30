import { z } from "zod";
import { EQUIPMENT_TYPES } from "./contract";
export function todayBangkok(now = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Bangkok",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);
}
export function draftSchema(ownerEmail: string) {
	return z.object({
		employeeName: z
			.string()
			.trim()
			.min(2, "ชื่อผู้ขอต้องมี 2–100 ตัวอักษร")
			.max(100, "ชื่อผู้ขอต้องมี 2–100 ตัวอักษร"),
		employeeEmail: z
			.email("Email ไม่ถูกต้อง")
			.refine(
				(value) => value === ownerEmail,
				"Email ต้องตรงกับผู้ใช้ที่เลือก",
			),
		department: z.string().trim().min(1, "กรุณาระบุแผนก"),
		title: z
			.string()
			.trim()
			.min(5, "ชื่อเรื่องต้องมี 5–150 ตัวอักษร")
			.max(150, "ชื่อเรื่องต้องมี 5–150 ตัวอักษร"),
		purpose: z
			.string()
			.trim()
			.min(10, "วัตถุประสงค์ต้องมี 10–500 ตัวอักษร")
			.max(500, "วัตถุประสงค์ต้องมี 10–500 ตัวอักษร"),
		requiredDate: z.iso
			.date("กรุณาระบุวันที่ที่ถูกต้อง")
			.refine(
				(value) => value >= todayBangkok(),
				"วันที่ต้องไม่เป็นอดีตตาม Asia/Bangkok",
			),
		additionalNote: z
			.string()
			.max(500, "หมายเหตุสูงสุด 500 ตัวอักษร")
			.optional(),
		items: z.array(
			z.object({
				equipmentType: z.enum(EQUIPMENT_TYPES, {
					error: "กรุณาเลือกประเภทอุปกรณ์",
				}),
				quantity: z
					.number({ error: "กรุณาระบุจำนวนเต็ม 1–5" })
					.int("จำนวนต้องเป็นจำนวนเต็ม")
					.min(1, "จำนวนต้องอยู่ระหว่าง 1–5")
					.max(5, "จำนวนต้องอยู่ระหว่าง 1–5"),
				specification: z
					.string()
					.max(250, "Specification สูงสุด 250 ตัวอักษร")
					.optional(),
			}),
		),
	});
}
export const versionSchema = z.object({
	version: z.number().int().nonnegative(),
});
export const rejectSchema = versionSchema.extend({
	reason: z.string().trim().min(1, "กรุณาระบุเหตุผลที่ปฏิเสธ"),
});
