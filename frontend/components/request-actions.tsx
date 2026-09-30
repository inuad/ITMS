import {
	allowedActions,
	type Action,
	type Identity,
	type RequestRow,
} from "../lib/contract";

export const actionLabels = {
	edit: "แก้ไข",
	submit: "ส่งคำขอ",
	cancel: "ยกเลิก",
	approve: "อนุมัติ",
	reject: "ปฏิเสธ",
};
export function RequestActions({
	identity,
	request,
	onAction,
}: {
	identity: Identity;
	request: RequestRow;
	onAction: (action: Action, request: RequestRow) => void;
}) {
	const actions = allowedActions(identity, request);
	return actions.length > 0 ? (
		<div className="actions">
			{actions.map((action) => (
				<button key={action} onClick={() => onAction(action, request)}>
					{actionLabels[action]}
				</button>
			))}
		</div>
	) : null;
}
