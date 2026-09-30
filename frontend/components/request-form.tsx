"use client";
import { useRef, useState } from "react";
import { useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, createApi } from "../lib/api";
import {
	EQUIPMENT_TYPES,
	type DraftInput,
	type Identity,
	type RequestDetail,
} from "../lib/contract";
import { draftSchema, todayBangkok } from "../lib/validation";
import { useUnsavedChanges } from "../lib/use-unsaved-changes";
import { Dialog } from "./dialog";

function valuesFor(identity: Identity, request?: RequestDetail): DraftInput {
	return {
		employeeName: request?.employeeName ?? identity.name,
		employeeEmail: identity.email,
		department: request?.department ?? identity.department,
		title: request?.title ?? "",
		purpose: request?.purpose ?? "",
		requiredDate: request?.requiredDate ?? "",
		additionalNote: request?.additionalNote ?? "",
		items:
			request?.items.map(
				({ equipmentType, quantity, specification }) => ({
					equipmentType,
					quantity,
					specification: specification ?? "",
				}),
			) ?? [],
	};
}
export function RequestForm({
	identity,
	request,
	onClose,
	onSaved,
	onRefresh,
}: {
	identity: Identity;
	request?: RequestDetail;
	onClose: () => void;
	onSaved: (saved: RequestDetail) => void;
	onRefresh: () => void;
}) {
	const {
		register,
		control,
		handleSubmit,
		reset,
		setError,
		formState: { errors, isDirty, isSubmitting },
	} = useForm<DraftInput>({
		resolver: zodResolver(draftSchema(identity.email)),
		defaultValues: valuesFor(identity, request),
	});
	const { fields, append, remove } = useFieldArray({
		control,
		name: "items",
	});
	const [version, setVersion] = useState(request?.version ?? 0);
	const [message, setMessage] = useState("");
	const [failure, setFailure] = useState("");
	const [conflict, setConflict] = useState(false);
	const [saving, setSaving] = useState(false);
	const [reloading, setReloading] = useState(false);
	const lock = useRef(false);
	const busy = isSubmitting || saving || reloading;
	const allowDiscard = useUnsavedChanges(isDirty);
	const close = () => {
		if (!busy && allowDiscard()) onClose();
	};
	const save = handleSubmit(async (input) => {
		if (lock.current || conflict) return;
		lock.current = true;
		setSaving(true);
		setFailure("");
		setMessage("");
		try {
			const api = createApi(identity);
			const saved = request
				? await api.edit(request.id, {
						...input,
						employeeEmail: identity.email,
						version,
					})
				: await api.create({ ...input, employeeEmail: identity.email });
			reset(valuesFor(identity, request ? saved : undefined));
			setVersion(saved.version);
			setMessage(`บันทึก ${saved.requestNumber} สำเร็จ`);
			onSaved(saved);
		} catch (error) {
			if (error instanceof ApiError) {
				for (const [field, message] of Object.entries(
					error.body.fieldErrors,
				))
					setError(field as FieldPath<DraftInput>, {
						type: "server",
						message,
					});
				setConflict(error.body.code === "REQUEST_VERSION_CONFLICT");
			}
			setFailure(
				error instanceof Error
					? error.message
					: "ไม่สามารถบันทึกได้ กรุณาลองใหม่",
			);
		} finally {
			lock.current = false;
			setSaving(false);
		}
	});
	async function reloadLatest() {
		if (!request || lock.current || !allowDiscard()) return;
		lock.current = true;
		setReloading(true);
		try {
			const latest = await createApi(identity).detail(request.id);
			if (latest.status !== "DRAFT") {
				setFailure(
					"คำขอไม่ใช่ DRAFT แล้ว กรุณาปิดฟอร์มเพื่อดูสถานะล่าสุด",
				);
				onRefresh();
				return;
			}
			reset(valuesFor(identity, latest));
			setVersion(latest.version);
			setConflict(false);
			setFailure("");
			setMessage("โหลดข้อมูลล่าสุดแล้ว");
			onRefresh();
		} catch (error) {
			setFailure(
				error instanceof Error
					? error.message
					: "โหลดข้อมูลล่าสุดไม่สำเร็จ",
			);
		} finally {
			lock.current = false;
			setReloading(false);
		}
	}
	const errorFor = (message?: string) =>
		message ? (
			<span className="error-text" role="alert">
				{message}
			</span>
		) : null;
	return (
		<Dialog
			title={
				request ? `แก้ไข ${request.requestNumber}` : "สร้างคำขออุปกรณ์"
			}
			onClose={close}
			busy={busy}
		>
			<form className="request-form" onSubmit={save} noValidate>
				<div className="form-meta">
					<span>
						{isDirty
							? "มีข้อมูลที่ยังไม่บันทึก"
							: "ข้อมูลยังไม่มีการเปลี่ยนแปลง"}
					</span>
					{request && <small>Version {version}</small>}
				</div>
				<fieldset disabled={busy} className="form-fields">
					<div className="form-grid">
						<label className="field">
							ชื่อผู้ขอ
							<input
								{...register("employeeName")}
								aria-invalid={!!errors.employeeName}
							/>
							{errorFor(errors.employeeName?.message)}
						</label>
						<label className="field">
							Email ผู้ขอ
							<input
								{...register("employeeEmail")}
								readOnly
								aria-invalid={!!errors.employeeEmail}
							/>
							{errorFor(errors.employeeEmail?.message)}
						</label>
						<label className="field">
							แผนก
							<input
								{...register("department")}
								aria-invalid={!!errors.department}
							/>
							{errorFor(errors.department?.message)}
						</label>
						<label className="field">
							วันที่ต้องการใช้งาน
							<input
								type="date"
								min={todayBangkok()}
								{...register("requiredDate")}
								aria-invalid={!!errors.requiredDate}
							/>
							{errorFor(errors.requiredDate?.message)}
						</label>
					</div>
					<label className="field">
						ชื่อเรื่อง
						<input
							{...register("title")}
							aria-invalid={!!errors.title}
						/>
						{errorFor(errors.title?.message)}
					</label>
					<label className="field">
						วัตถุประสงค์
						<textarea
							rows={3}
							{...register("purpose")}
							aria-invalid={!!errors.purpose}
						/>
						{errorFor(errors.purpose?.message)}
					</label>
					<label className="field">
						หมายเหตุเพิ่มเติม
						<textarea
							rows={2}
							{...register("additionalNote")}
							aria-invalid={!!errors.additionalNote}
						/>
						{errorFor(errors.additionalNote?.message)}
					</label>
					<div className="equipment-heading">
						<h3>รายการอุปกรณ์</h3>
						<button
							type="button"
							onClick={() =>
								append({
									equipmentType: "NOTEBOOK",
									quantity: 1,
									specification: "",
								})
							}
						>
							เพิ่มอุปกรณ์
						</button>
					</div>
					{fields.length === 0 && (
						<p className="muted">
							Draft ยังไม่มีอุปกรณ์ได้ แต่ต้องเพิ่มอย่างน้อย 1
							รายการก่อนส่งคำขอ
						</p>
					)}
					{fields.map((item, index) => (
						<fieldset className="item-fields" key={item.id}>
							<legend>อุปกรณ์ {index + 1}</legend>
							<div className="item-grid">
								<label className="field">
									ประเภทอุปกรณ์
									<select
										{...register(
											`items.${index}.equipmentType`,
										)}
									>
										{EQUIPMENT_TYPES.map((type) => (
											<option key={type} value={type}>
												{type}
											</option>
										))}
									</select>
									{errorFor(
										errors.items?.[index]?.equipmentType
											?.message,
									)}
								</label>
								<label className="field">
									จำนวน
									<input
										type="number"
										min={1}
										max={5}
										step={1}
										{...register(
											`items.${index}.quantity`,
											{
												valueAsNumber: true,
											},
										)}
										aria-invalid={
											!!errors.items?.[index]?.quantity
										}
									/>
									{errorFor(
										errors.items?.[index]?.quantity
											?.message,
									)}
								</label>
								<button
									type="button"
									aria-label={`ลบอุปกรณ์ ${index + 1}`}
									onClick={() => remove(index)}
								>
									ลบ
								</button>
							</div>
							<label className="field">
								Specification
								<input
									{...register(
										`items.${index}.specification`,
									)}
								/>
								{errorFor(
									errors.items?.[index]?.specification
										?.message,
								)}
							</label>
						</fieldset>
					))}
				</fieldset>
				{failure && (
					<p role="alert" className="error-text">
						{failure}
					</p>
				)}
				{message && (
					<p role="status" className="success-text">
						{message}
					</p>
				)}
				{conflict && (
					<div className="conflict-notice">
						<p>
							ข้อมูลที่กรอกยังอยู่
							กรุณาเลือกโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง
						</p>
						{request ? (
							<button
								type="button"
								disabled={busy}
								onClick={reloadLatest}
							>
								โหลดล่าสุดและแทนค่าที่กรอก
							</button>
						) : (
							<button
								type="button"
								disabled={busy}
								onClick={() => {
									setConflict(false);
									setFailure("");
								}}
							>
								กลับไปตรวจข้อมูล
							</button>
						)}
					</div>
				)}
				<div className="form-buttons">
					<button type="button" onClick={close} disabled={busy}>
						ปิดฟอร์ม
					</button>
					<button
						className="primary"
						type="submit"
						disabled={busy || conflict}
					>
						{saving ? "กำลังบันทึก…" : "บันทึก Draft"}
					</button>
				</div>
			</form>
		</Dialog>
	);
}
