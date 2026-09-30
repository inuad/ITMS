"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createApi } from "../lib/api";
import {
	bangkokDate,
	type Action,
	type Identity,
	type RequestDetail as RequestDetailData,
	type RequestRow,
} from "../lib/contract";
import { useRequest } from "../lib/use-request";
import { RequestActions } from "./request-actions";
import { StatusBadge } from "./status-badge";

export function RequestDetail({
	id,
	revision,
	onAction,
	identity,
	onClose,
}: {
	id: string;
	revision: number;
	onAction: (action: Action, request: RequestRow) => void;
	identity: Identity;
	onClose: () => void;
}) {
	const panel = useRef<HTMLElement>(null);
	useEffect(() => {
		const trigger = document.activeElement;
		panel.current?.focus();
		return () => {
			if (trigger instanceof HTMLElement && trigger.isConnected)
				trigger.focus();
		};
	}, []);
	const [retry, setRetry] = useState(0);
	const loadDetail = useCallback(
		(signal: AbortSignal) => createApi(identity).detail(id, signal),
		[identity, id, retry, revision],
	);
	const detail = useRequest(loadDetail);
	return (
		<section
			ref={panel}
			tabIndex={-1}
			className="card detail-card"
			aria-labelledby="detail-title"
		>
			<div className="card-heading">
				<h2 id="detail-title">รายละเอียดคำขอ</h2>
				<button onClick={onClose}>ปิดรายละเอียด</button>
			</div>
			{detail.status === "loading" && (
				<div className="state" role="status">
					กำลังโหลดรายละเอียด…
				</div>
			)}
			{detail.status === "error" && (
				<div className="state">
					<p role="alert">{detail.message}</p>
					<button onClick={() => setRetry((value) => value + 1)}>
						ลองอีกครั้ง
					</button>
				</div>
			)}
			{detail.status === "success" && (
				<DetailContent
					request={detail.data}
					identity={identity}
					onAction={onAction}
				/>
			)}
		</section>
	);
}
function DetailContent({
	request,
	identity,
	onAction,
}: {
	request: RequestDetailData;
	identity: Identity;
	onAction: (action: Action, request: RequestRow) => void;
}) {
	return (
		<div className="detail-content">
			<div className="detail-heading">
				<div>
					<p className="request-number">{request.requestNumber}</p>
					<h3>{request.title}</h3>
				</div>
				<StatusBadge status={request.status} />
			</div>
			<dl className="detail-grid">
				<div>
					<dt>ผู้ขอ</dt>
					<dd>{request.employeeName}</dd>
				</div>
				<div>
					<dt>Email เจ้าของคำขอ</dt>
					<dd>{request.employeeEmail}</dd>
				</div>
				<div>
					<dt>แผนก</dt>
					<dd>{request.department}</dd>
				</div>
				<div>
					<dt>วันที่ต้องการใช้งาน</dt>
					<dd>{bangkokDate(request.requiredDate)}</dd>
				</div>
				<div>
					<dt>สร้างเมื่อ</dt>
					<dd>{bangkokDate(request.createdAt, true)}</dd>
				</div>
				<div>
					<dt>แก้ไขล่าสุด</dt>
					<dd>{bangkokDate(request.updatedAt, true)}</dd>
				</div>
			</dl>
			<h4>วัตถุประสงค์</h4>
			<p className="preserve">{request.purpose}</p>
			<h4>หมายเหตุเพิ่มเติม</h4>
			<p className="preserve">{request.additionalNote || "—"}</p>
			{request.rejectionReason && (
				<div className="rejection">
					<h4>เหตุผลที่ปฏิเสธ</h4>
					<p className="preserve">{request.rejectionReason}</p>
				</div>
			)}
			<div className="equipment-heading">
				<h4>รายการอุปกรณ์</h4>
				<span>{request.totalItems} ชิ้น</span>
			</div>
			{request.items.length === 0 ? (
				<p>ยังไม่มีรายการอุปกรณ์</p>
			) : (
				<ul className="equipment-list">
					{request.items.map((item) => (
						<li key={item.id}>
							<div>
								<strong>{item.equipmentType}</strong>
								<small>
									{item.specification ||
										"ไม่ได้ระบุ specification"}
								</small>
							</div>
							<span>× {item.quantity}</span>
						</li>
					))}
				</ul>
			)}
			<div className="detail-bottom">
				<RequestActions
					identity={identity}
					request={request}
					onAction={onAction}
				/>
				<small className="muted">Version {request.version}</small>
			</div>
		</div>
	);
}
