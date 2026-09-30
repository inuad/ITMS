import type {
	ApiErrorBody,
	DraftInput,
	EditInput,
	Identity,
	ListQuery,
	Page,
	RejectInput,
	RequestDetail,
	RequestRow,
	VersionInput,
} from "./contract";
import { z } from "zod";

const errorSchema = z.object({
	timestamp: z.string(),
	status: z.number(),
	code: z.string(),
	message: z.string(),
	path: z.string(),
	fieldErrors: z.record(z.string(), z.string()),
});

export class ApiError extends Error {
	constructor(public readonly body: ApiErrorBody) {
		super(body.message);
	}
}
export function createApi(identity: Identity) {
	const origin = (
		process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080"
	).replace(/\/+$/, "");
	const base = `${origin}/api/v1/equipment-requests`;
	async function request<T>(
		path: string,
		method: string,
		body?: unknown,
		signal?: AbortSignal,
	): Promise<T> {
		const init: RequestInit = {
			method,
			signal,
			headers: {
				"Content-Type": "application/json",
				"X-User-Role": identity.role,
				"X-User-Email": identity.email,
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		};
		const response = await fetch(`${base}${path}`, init);
		let payload: unknown;
		try {
			payload = await response.json();
		} catch {
			throw new Error("ไม่สามารถอ่านคำตอบจากระบบได้ กรุณาลองใหม่");
		}
		if (!response.ok) {
			const error = errorSchema.safeParse(payload);
			if (error.success) throw new ApiError(error.data);
			throw new Error(
				`ระบบตอบกลับไม่สำเร็จ (${response.status}) กรุณาลองใหม่`,
			);
		}
		return payload as T;
	}
	return {
		list: (query: ListQuery = {}, signal?: AbortSignal) => {
			const params = new URLSearchParams();
			for (const [key, value] of Object.entries(query))
				if (value !== undefined) params.set(key, String(value));
			return request<Page<RequestRow>>(
				params.size ? `?${params}` : "",
				"GET",
				undefined,
				signal,
			);
		},
		detail: (id: string, signal?: AbortSignal) =>
			request<RequestDetail>(
				`/${encodeURIComponent(id)}`,
				"GET",
				undefined,
				signal,
			),
		create: (input: DraftInput) =>
			request<RequestDetail>("", "POST", input),
		edit: (id: string, input: EditInput) =>
			request<RequestDetail>(`/${encodeURIComponent(id)}`, "PUT", input),
		submit: (id: string, input: VersionInput) =>
			request<RequestDetail>(
				`/${encodeURIComponent(id)}/submit`,
				"POST",
				input,
			),
		approve: (id: string, input: VersionInput) =>
			request<RequestDetail>(
				`/${encodeURIComponent(id)}/approve`,
				"POST",
				input,
			),
		reject: (id: string, input: RejectInput) =>
			request<RequestDetail>(
				`/${encodeURIComponent(id)}/reject`,
				"POST",
				input,
			),
		cancel: (id: string, input: VersionInput) =>
			request<RequestDetail>(
				`/${encodeURIComponent(id)}/cancel`,
				"POST",
				input,
			),
	};
}
