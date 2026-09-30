"use client";
import { useEffect, useState } from "react";

type LoadState<T> =
	| { status: "loading" }
	| { status: "success"; data: T }
	| { status: "error"; message: string };
export function useRequest<T>(load: (signal: AbortSignal) => Promise<T>) {
	const [state, setState] = useState<{
		load: typeof load;
		result: LoadState<T>;
	} | null>(null);
	useEffect(() => {
		const controller = new AbortController();
		load(controller.signal).then(
			(data) => {
				if (!controller.signal.aborted)
					setState({ load, result: { status: "success", data } });
			},
			(error: unknown) => {
				if (!controller.signal.aborted)
					setState({
						load,
						result: {
							status: "error",
							message:
								error instanceof Error
									? error.message
									: "ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่",
						},
					});
			},
		);
		return () => controller.abort();
	}, [load]);
	return state?.load === load
		? state.result
		: ({ status: "loading" } as LoadState<T>);
}
