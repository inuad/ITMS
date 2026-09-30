"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, createApi } from "../lib/api";
import {
	allowedActions,
	type Action,
	type Identity,
	type RequestDetail,
	type RequestRow,
} from "../lib/contract";
import { rejectSchema } from "../lib/validation";
import { useUnsavedChanges } from "../lib/use-unsaved-changes";
import { Dialog } from "./dialog";
import { actionLabels } from "./request-actions";
export function WorkflowDialog({
	action,
	request,
	identity,
	onClose,
	onSaved,
	onRefresh,
}: {
	action: Exclude<Action, "edit">;
	request: RequestRow;
	identity: Identity;
	onClose: () => void;
	onSaved: (saved: RequestDetail) => void;
	onRefresh: () => void;
}) {
	const {
		register,
		handleSubmit,
		reset,
		setError: setFieldError,
		formState: { errors, isSubmitting, isDirty },
	} = useForm<{ reason: string }>({
		defaultValues: { reason: "" },
		resolver:
			action === "reject"
				? zodResolver(rejectSchema.pick({ reason: true }))
				: undefined,
	});
	const [current, setCurrent] = useState(request);
	const [saving, setSaving] = useState(false);
	const [reloading, setReloading] = useState(false);
	const busy = isSubmitting || saving || reloading;
	const [error, setError] = useState("");
	const [conflict, setConflict] = useState(false);
	const lock = useRef(false);
	const allowDiscard = useUnsavedChanges(isDirty);
	const close = () => {
		if (!busy && allowDiscard()) onClose();
	};
	const submit = handleSubmit(async ({ reason }) => {
		if (lock.current || conflict) return;
		lock.current = true;
		setSaving(true);
		setError("");
		try {
			const api = createApi(identity);
			const saved =
				action === "reject"
					? await api.reject(current.id, {
							version: current.version,
							reason: reason.trim(),
						})
					: await api[action](current.id, {
							version: current.version,
						});
			onSaved(saved);
			onClose();
		} catch (error) {
			if (error instanceof ApiError && error.body.fieldErrors.reason)
				setFieldError("reason", {
					type: "server",
					message: error.body.fieldErrors.reason,
				});
			setConflict(
				error instanceof ApiError &&
					error.body.code === "REQUEST_VERSION_CONFLICT",
			);
			setError(
				error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ",
			);
		} finally {
			lock.current = false;
			setSaving(false);
		}
	});
	async function reloadLatest() {
		if (lock.current || !allowDiscard()) return;
		lock.current = true;
		setReloading(true);
		try {
			const latest = await createApi(identity).detail(current.id);
			setCurrent(latest);
			reset({ reason: "" });
			onRefresh();
			const permitted = allowedActions(identity, latest).includes(action);
			setConflict(!permitted);
			setError(permitted ? "" : "สถานะล่าสุดไม่อนุญาตให้ทำรายการนี้แล้ว");
		} catch (error) {
			setError(
				error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
			);
		} finally {
			lock.current = false;
			setReloading(false);
		}
	}
	return (
		<Dialog
			title={`${actionLabels[action]} ${request.requestNumber}`}
			onClose={close}
			busy={busy}
		>
			<form className="request-form" onSubmit={submit} noValidate>
				<p>{current.title}</p>
				<p className="muted">
					Version {current.version} ·
					ตรวจสถานะและสิทธิ์อีกครั้งเมื่อทำรายการ
				</p>
				{action === "reject" && (
					<label className="field">
						เหตุผลที่ปฏิเสธ
						<textarea
							rows={3}
							{...register("reason")}
							disabled={busy}
							aria-invalid={!!errors.reason}
						/>
						{errors.reason && (
							<span className="error-text" role="alert">
								{errors.reason.message}
							</span>
						)}
					</label>
				)}
				{error && (
					<p role="alert" className="error-text">
						{error}
					</p>
				)}
				{conflict && (
					<div className="conflict-notice">
						<p>
							ข้อมูลที่กรอกยังอยู่
							เลือกโหลดข้อมูลล่าสุดก่อนทำรายการอีกครั้ง
						</p>
						<button
							type="button"
							disabled={busy}
							onClick={reloadLatest}
						>
							โหลดข้อมูลล่าสุด
						</button>
					</div>
				)}
				<div className="form-buttons">
					<button type="button" disabled={busy} onClick={close}>
						ปิดหน้าต่าง
					</button>
					<button
						className="primary"
						type="submit"
						disabled={busy || conflict}
					>
						{saving
							? "กำลังทำรายการ…"
							: `ยืนยัน${actionLabels[action]}`}
					</button>
				</div>
			</form>
		</Dialog>
	);
}
