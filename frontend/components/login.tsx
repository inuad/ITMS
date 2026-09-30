"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { USERS, type Identity } from "../lib/contract";
const loginSchema = z
	.object({
		role: z.enum(["EMPLOYEE", "APPROVER"]),
		email: z.email("กรุณาเลือกผู้ใช้งาน"),
	})
	.refine(
		(value) =>
			USERS.some(
				(user) =>
					user.role === value.role && user.email === value.email,
			),
		{ path: ["email"], message: "กรุณาเลือกผู้ใช้ของ Role นี้" },
	);
type LoginValues = z.infer<typeof loginSchema>;

export function Login({ onLogin }: { onLogin: (user: Identity) => void }) {
	const {
		register,
		handleSubmit,
		watch,
		setValue,
		formState: { errors },
	} = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { role: "EMPLOYEE", email: "" },
	});
	const role = watch("role");
	const email = watch("email");
	return (
		<main className="login-layout">
			<section className="intro">
				<p className="eyebrow">YOUR TOOLS. YOUR NEXT PROJECT.</p>
				<h1>
					อุปกรณ์ที่พร้อม
					<br />
					สำหรับงานของคุณ<span>.</span>
				</h1>
				<p>
					ดูคำขออุปกรณ์และติดตามสถานะ
					<br />
					ในพื้นที่เดียวที่เรียบง่าย
				</p>
				<div className="intro-note">
					<span>01 / 03</span> เลือกผู้ใช้ → ดูคำขอ → ตรวจรายละเอียด
				</div>
			</section>
			<section className="card login-card">
				<p className="eyebrow">GET STARTED</p>
				<h2>เข้าสู่พื้นที่ทำงาน</h2>
				<p className="muted">เลือกบทบาทและผู้ใช้งานจำลอง</p>
				<form
					onSubmit={handleSubmit((values) => {
						const user = USERS.find(
							(user) =>
								user.email === values.email &&
								user.role === values.role,
						);
						if (user) onLogin(user);
					})}
				>
					<fieldset>
						<legend>1. บทบาท</legend>
						<div className="role-options">
							{(["EMPLOYEE", "APPROVER"] as const).map(
								(value) => (
									<label
										key={value}
										className={
											role === value
												? "role selected"
												: "role"
										}
									>
										<input
											type="radio"
											value={value}
											{...register("role", {
												onChange: () =>
													setValue("email", ""),
											})}
										/>
										<strong>
											{value === "EMPLOYEE"
												? "Employee"
												: "Approver"}
										</strong>
										<small>
											{value === "EMPLOYEE"
												? "ดูคำขอของฉัน"
												: "ตรวจคำขอทั้งหมด"}
										</small>
									</label>
								),
							)}
						</div>
					</fieldset>
					<label className="field" htmlFor="user">
						2. ผู้ใช้งาน
						<select
							id="user"
							{...register("email")}
							aria-invalid={!!errors.email}
							aria-describedby={
								errors.email ? "login-error" : undefined
							}
						>
							<option value="">เลือกผู้ใช้งาน</option>
							{USERS.filter((user) => user.role === role).map(
								(user) => (
									<option key={user.email} value={user.email}>
										{user.name}
									</option>
								),
							)}
						</select>
					</label>
					{errors.email && (
						<p id="login-error" role="alert" className="error-text">
							{errors.email.message}
						</p>
					)}
					{email && <p className="identity-preview">{email}</p>}
					<button className="primary wide" type="submit">
						เข้าสู่ระบบ <span aria-hidden="true">→</span>
					</button>
				</form>
				<p className="simulation-note">
					การเข้าสู่ระบบนี้เป็นการจำลองผู้ใช้ ไม่มีรหัสผ่าน
				</p>
			</section>
		</main>
	);
}
