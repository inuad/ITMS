"use client";
import { useEffect, useState } from "react";
import { STATUSES, type ListQuery } from "./contract";
export type Query = Required<
	Pick<ListQuery, "keyword" | "department" | "page" | "size" | "sort">
> &
	Pick<ListQuery, "status">;
function readQuery(): Query {
	const params = new URLSearchParams(window.location.search);
	const page = Number(params.get("page") ?? 0);
	const size = Number(params.get("size") ?? 10);
	const status = params.get("status");
	return {
		keyword: params.get("keyword") ?? "",
		department: params.get("department") ?? "",
		status: STATUSES.find((value) => value === status),
		page: Number.isSafeInteger(page) && page >= 0 ? page : 0,
		size: Number.isInteger(size) && size >= 1 && size <= 100 ? size : 10,
		sort:
			params.get("sort") === "createdAt,asc"
				? "createdAt,asc"
				: "createdAt,desc",
	};
}
export function useListQuery() {
	const [query, setQuery] = useState(readQuery);
	useEffect(() => {
		const restore = () => setQuery(readQuery());
		window.addEventListener("popstate", restore);
		return () => window.removeEventListener("popstate", restore);
	}, []);
	function changeQuery(patch: Partial<Query>) {
		const next = { ...query, ...patch, page: patch.page ?? 0 };
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(next))
			if (value !== undefined && value !== "")
				params.set(key, String(value));
		window.history.pushState(
			null,
			"",
			`${window.location.pathname}?${params}${window.location.hash}`,
		);
		setQuery(next);
	}
	return { query, changeQuery };
}
