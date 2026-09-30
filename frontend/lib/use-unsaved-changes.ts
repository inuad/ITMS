"use client";
import { useEffect } from "react";
export function useUnsavedChanges(dirty: boolean) {
	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);
	return () =>
		!dirty ||
		window.confirm("มีข้อมูลที่ยังไม่บันทึก ต้องการทิ้งข้อมูลนี้หรือไม่?");
}
