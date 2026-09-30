"use client";
import { useRef, useState } from "react";
import { createApi } from "../lib/api";
import {
	allowedActions,
	type Action,
	type Identity,
	type RequestDetail as RequestDetailData,
	type RequestRow,
} from "../lib/contract";
import { RequestList } from "./request-list";
import { RequestDetail } from "./request-detail";
import { RequestForm } from "./request-form";
import { WorkflowDialog } from "./workflow-dialog";

export function Workspace({
	identity,
	onLogout,
}: {
	identity: Identity;
	onLogout: () => void;
}) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [revision, setRevision] = useState(0);
	const [dialog, setDialog] = useState<
		| { kind: "create" }
		| { kind: "edit"; request: RequestDetailData }
		| {
				kind: "action";
				action: Exclude<Action, "edit">;
				request: RequestRow;
		  }
		| null
	>(null);
	const [notice, setNotice] = useState("");
	const [actionError, setActionError] = useState("");
	const opening = useRef(false);
	async function openAction(action: Action, request: RequestRow) {
		if (opening.current) return;
		setActionError("");
		if (action !== "edit") {
			setDialog({ kind: "action", action, request });
			return;
		}
		opening.current = true;
		try {
			const latest = await createApi(identity).detail(request.id);
			if (!allowedActions(identity, latest).includes("edit"))
				throw new Error("คำขอไม่ใช่ DRAFT แล้ว กรุณาโหลดข้อมูลล่าสุด");
			setDialog({ kind: "edit", request: latest });
		} catch (error) {
			setActionError(
				error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ",
			);
		} finally {
			opening.current = false;
		}
	}
	function saved(request: RequestDetailData, workflow = false) {
		setRevision((value) => value + 1);
		setNotice(
			`${workflow ? "ทำรายการ" : "บันทึก"} ${request.requestNumber} สำเร็จ`,
		);
	}
	return (
		<main className="workspace">
			<div className="userbar">
				<div>
					<span className="avatar">{identity.name[0]}</span>
					<span>
						<strong>{identity.name}</strong>
						<small>
							{identity.role === "EMPLOYEE"
								? "Employee"
								: "Approver"}{" "}
							· {identity.email}
						</small>
					</span>
				</div>
				<button onClick={onLogout}>เปลี่ยนผู้ใช้</button>
			</div>
			<div className="page-heading">
				<div>
					<p className="eyebrow">REQUEST DESK</p>
					<h1>
						{identity.role === "EMPLOYEE"
							? "คำขอของฉัน"
							: "คำขอทั้งหมด"}
					</h1>
					<p className="muted">
						{identity.role === "EMPLOYEE"
							? "ติดตามอุปกรณ์ที่คุณต้องการและสถานะของแต่ละคำขอ"
							: "ตรวจรายละเอียดคำขออุปกรณ์ของพนักงานทุกคน"}
					</p>
				</div>
				{identity.role === "EMPLOYEE" && (
					<button
						className="primary"
						onClick={() => setDialog({ kind: "create" })}
					>
						สร้างคำขอ
					</button>
				)}
			</div>
			<RequestList
				identity={identity}
				revision={revision}
				onSelect={setSelectedId}
				onAction={openAction}
				onRefresh={() => setRevision((value) => value + 1)}
			>
				{notice && (
					<p role="status" className="success-text">
						{notice}
					</p>
				)}
				{actionError && (
					<p role="alert" className="error-text">
						{actionError}
					</p>
				)}
			</RequestList>

			{selectedId && (
				<RequestDetail
					key={selectedId}
					revision={revision}
					onAction={openAction}
					id={selectedId}
					identity={identity}
					onClose={() => setSelectedId(null)}
				/>
			)}
			{dialog?.kind === "create" && (
				<RequestForm
					onRefresh={() => setRevision((value) => value + 1)}
					identity={identity}
					onClose={() => setDialog(null)}
					onSaved={saved}
				/>
			)}
			{dialog?.kind === "edit" && (
				<RequestForm
					onRefresh={() => setRevision((value) => value + 1)}
					identity={identity}
					request={dialog.request}
					onClose={() => setDialog(null)}
					onSaved={saved}
				/>
			)}
			{dialog?.kind === "action" && (
				<WorkflowDialog
					onRefresh={() => setRevision((value) => value + 1)}
					identity={identity}
					request={dialog.request}
					action={dialog.action}
					onClose={() => setDialog(null)}
					onSaved={(request) => saved(request, true)}
				/>
			)}
		</main>
	);
}
