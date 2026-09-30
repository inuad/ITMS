export const STATUSES = [
	"DRAFT",
	"PENDING",
	"APPROVED",
	"REJECTED",
	"CANCELLED",
] as const;
export const EQUIPMENT_TYPES = [
	"NOTEBOOK",
	"MONITOR",
	"KEYBOARD",
	"MOUSE",
	"HEADSET",
	"OTHER",
] as const;
export type Status = (typeof STATUSES)[number];
export type Role = "EMPLOYEE" | "APPROVER";
export type Identity = {
	role: Role;
	email: string;
	name: string;
	department: string;
};
export const USERS: readonly Identity[] = [
	{
		role: "EMPLOYEE",
		email: "somchai@example.com",
		name: "Somchai Developer",
		department: "Software Engineering",
	},
	{
		role: "EMPLOYEE",
		email: "suda@example.com",
		name: "Suda Analyst",
		department: "Finance",
	},
	{
		role: "APPROVER",
		email: "arun@example.com",
		name: "Arun Approver",
		department: "IT",
	},
];
export type ItemInput = {
	equipmentType: (typeof EQUIPMENT_TYPES)[number];
	quantity: number;
	specification?: string;
};
export type DraftInput = {
	employeeName: string;
	employeeEmail: string;
	department: string;
	title: string;
	purpose: string;
	requiredDate: string;
	additionalNote?: string;
	items: ItemInput[];
};
export type VersionInput = { version: number };
export type EditInput = DraftInput & VersionInput;
export type RejectInput = VersionInput & { reason: string };
export type RequestRow = {
	id: string;
	requestNumber: string;
	employeeName: string;
	employeeEmail: string;
	department: string;
	title: string;
	requiredDate: string;
	totalItems: number;
	status: Status;
	version: number;
	createdAt: string;
	updatedAt: string;
};
export type RequestDetail = RequestRow & {
	purpose: string;
	additionalNote: string | null;
	rejectionReason: string | null;
	items: (ItemInput & { id: string; createdAt: string; updatedAt: string })[];
};
export type Page<T> = {
	content: T[];
	page: number;
	size: number;
	totalElements: number;
	totalPages: number;
};
export type ListQuery = {
	keyword?: string;
	status?: Status;
	department?: string;
	page?: number;
	size?: number;
	sort?: "createdAt,asc" | "createdAt,desc";
};
export type ApiErrorBody = {
	timestamp: string;
	status: number;
	code: string;
	message: string;
	path: string;
	fieldErrors: Record<string, string>;
};
export type Action = "edit" | "submit" | "cancel" | "approve" | "reject";
export function allowedActions(
	identity: Identity,
	request: Pick<RequestRow, "status" | "employeeEmail">,
): Action[] {
	if (identity.role === "APPROVER")
		return request.status === "PENDING" ? ["approve", "reject"] : [];
	if (identity.email !== request.employeeEmail) return [];
	if (request.status === "DRAFT") return ["edit", "submit", "cancel"];
	return request.status === "PENDING" ? ["cancel"] : [];
}
export function bangkokDate(date: string, timestamp = false): string {
	return new Intl.DateTimeFormat("th-TH", {
		timeZone: "Asia/Bangkok",
		year: "numeric",
		month: "short",
		day: "numeric",
		...(timestamp
			? { hour: "2-digit", minute: "2-digit", hour12: false }
			: {}),
	}).format(new Date(date.length === 10 ? `${date}T00:00:00+07:00` : date));
}
