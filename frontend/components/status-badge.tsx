import type { Status } from "../lib/contract";

export const statusLabels: Record<Status, string> = {
	DRAFT: "ฉบับร่าง",
	PENDING: "รออนุมัติ",
	APPROVED: "อนุมัติแล้ว",
	REJECTED: "ถูกปฏิเสธ",
	CANCELLED: "ยกเลิกแล้ว",
};
export function StatusBadge({ status }: { status: Status }) {
	return (
		<span className={`badge ${status.toLowerCase()}`}>
			<span aria-hidden="true">●</span> {statusLabels[status]}
		</span>
	);
}
