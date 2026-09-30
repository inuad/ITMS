"use client";
import { useCallback, useEffect, type ReactNode } from "react";
import { createApi } from "../lib/api";
import {
	USERS,
	STATUSES,
	bangkokDate,
	type Action,
	type Identity,
	type RequestRow,
} from "../lib/contract";
import { useRequest } from "../lib/use-request";
import { useListQuery } from "../lib/use-list-query";
import { RequestActions } from "./request-actions";
import { StatusBadge, statusLabels } from "./status-badge";

export function RequestList({
	identity,
	revision,
	onSelect,
	onAction,
	onRefresh,
	children,
}: {
	identity: Identity;
	revision: number;
	onSelect: (id: string) => void;
	onAction: (action: Action, request: RequestRow) => void;
	onRefresh: () => void;
	children?: ReactNode;
}) {
	const { query, changeQuery } = useListQuery();
	const loadList = useCallback(
		(signal: AbortSignal) => createApi(identity).list(query, signal),
		[identity, revision, query],
	);
	const list = useRequest(loadList);
	useEffect(() => {
		if (
			list.status === "success" &&
			query.page > Math.max(0, list.data.totalPages - 1)
		)
			changeQuery({ page: Math.max(0, list.data.totalPages - 1) });
	}, [list, query.page, changeQuery]);
	return (
		<>
			<div className="search-toolbar">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						changeQuery({
							keyword: String(
								new FormData(event.currentTarget).get(
									"keyword",
								) ?? "",
							).trim(),
						});
					}}
				>
					<label htmlFor="keyword">ค้นหาคำขอ</label>
					<div className="search-input">
						<input
							id="keyword"
							name="keyword"
							key={query.keyword}
							defaultValue={query.keyword}
							placeholder="เลขคำขอ ชื่อเรื่อง หรือชื่อผู้ขอ"
						/>
						<button type="submit">ค้นหา</button>
					</div>
				</form>
				<label>
					กรองสถานะ
					<select
						value={query.status ?? ""}
						onChange={(event) =>
							changeQuery({
								status: STATUSES.find(
									(status) => status === event.target.value,
								),
							})
						}
					>
						<option value="">ทุกสถานะ</option>
						{STATUSES.map((status) => (
							<option key={status} value={status}>
								{statusLabels[status]}
							</option>
						))}
					</select>
				</label>
				<label>
					กรองแผนก
					<input
						list="departments"
						value={query.department}
						onChange={(event) =>
							changeQuery({ department: event.target.value })
						}
						placeholder="ทุกแผนก"
					/>
					<datalist id="departments">
						{Array.from(
							new Set(USERS.map((user) => user.department)),
						).map((department) => (
							<option key={department} value={department} />
						))}
					</datalist>
				</label>
				<label>
					เรียงวันที่สร้าง
					<select
						value={query.sort}
						onChange={(event) =>
							changeQuery({
								sort: event.target.value as
									"createdAt,asc" | "createdAt,desc",
							})
						}
					>
						<option value="createdAt,desc">ใหม่ที่สุดก่อน</option>
						<option value="createdAt,asc">เก่าที่สุดก่อน</option>
					</select>
				</label>
			</div>
			{children}
			<section className="card list-card" aria-labelledby="list-title">
				<div className="card-heading">
					<h2 id="list-title">รายการคำขอ</h2>
					<span className="muted">
						{list.status === "success"
							? `${list.data.totalElements} คำขอ`
							: ""}
					</span>
				</div>
				{list.status === "loading" && (
					<div className="state" role="status">
						<span className="spinner" />
						กำลังโหลดคำขอ…
					</div>
				)}
				{list.status === "error" && (
					<div className="state">
						<p role="alert">{list.message}</p>
						<button onClick={onRefresh}>ลองอีกครั้ง</button>
					</div>
				)}
				{list.status === "success" &&
					(list.data.content.length === 0 ? (
						<div className="state">
							<h3>ยังไม่มีคำขอ</h3>
							<p className="muted">
								เมื่อมีคำขอ รายการจะแสดงที่นี่
							</p>
						</div>
					) : (
						<div className="table-scroll">
							<table>
								<caption className="sr-only">
									รายการคำขออุปกรณ์ของ {identity.name}
								</caption>
								<thead>
									<tr>
										<th scope="col">คำขอ / ชื่อเรื่อง</th>
										<th scope="col">ผู้ขอ / แผนก</th>
										<th scope="col">วันที่ต้องการ</th>
										<th scope="col">จำนวนชิ้น</th>
										<th scope="col">สถานะ</th>
										<th scope="col">สร้างเมื่อ</th>
										<th scope="col">การจัดการ</th>
									</tr>
								</thead>
								<tbody>
									{list.data.content.map((request) => (
										<tr key={request.id}>
											<td>
												<button
													className="link-button request-number"
													onClick={() =>
														onSelect(request.id)
													}
												>
													{request.requestNumber}
												</button>
												<div className="request-title">
													{request.title}
												</div>
											</td>
											<td>
												{request.employeeName}
												<small>
													{request.department}
												</small>
											</td>
											<td className="nowrap">
												{bangkokDate(
													request.requiredDate,
												)}
											</td>
											<td>
												<span className="quantity">
													{request.totalItems}
												</span>
											</td>
											<td>
												<StatusBadge
													status={request.status}
												/>
											</td>
											<td className="nowrap">
												{bangkokDate(
													request.createdAt,
													true,
												)}
											</td>
											<td>
												<button
													onClick={() =>
														onSelect(request.id)
													}
													aria-label={`ดูรายละเอียด ${request.requestNumber}`}
												>
													ดูรายละเอียด
												</button>
												<RequestActions
													identity={identity}
													request={request}
													onAction={onAction}
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					))}
				{list.status === "success" && (
					<nav className="pagination" aria-label="หน้ารายการคำขอ">
						<label>
							จำนวนต่อหน้า
							<select
								value={query.size}
								onChange={(event) =>
									changeQuery({
										size: Number(event.target.value),
									})
								}
							>
								{Array.from(
									new Set([2, 5, 10, 20, 50, query.size]),
								)
									.sort((a, b) => a - b)
									.map((size) => (
										<option key={size} value={size}>
											{size}
										</option>
									))}
							</select>
						</label>
						<span>
							หน้า{" "}
							{list.data.totalPages === 0 ? 0 : query.page + 1} /{" "}
							{list.data.totalPages}
						</span>
						<div>
							<button
								disabled={query.page === 0}
								onClick={() =>
									changeQuery({ page: query.page - 1 })
								}
							>
								หน้าก่อน
							</button>
							<button
								disabled={
									query.page + 1 >= list.data.totalPages
								}
								onClick={() =>
									changeQuery({ page: query.page + 1 })
								}
							>
								หน้าถัดไป
							</button>
						</div>
					</nav>
				)}
			</section>
		</>
	);
}
