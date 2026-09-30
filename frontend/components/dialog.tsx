"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function Dialog({
	title,
	onClose,
	busy = false,
	children,
}: {
	title: string;
	onClose: () => void;
	busy?: boolean;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const dialog = ref.current!;
		dialog.showModal();
		return () => dialog.close();
	}, []);
	return (
		<dialog
			ref={ref}
			className="form-dialog"
			aria-labelledby="dialog-title"
			onCancel={(event) => {
				event.preventDefault();
				if (!busy) onClose();
			}}
		>
			<div className="card-heading">
				<h2 id="dialog-title">{title}</h2>
				<button
					type="button"
					disabled={busy}
					onClick={onClose}
					aria-label="ปิดหน้าต่าง"
				>
					ปิด
				</button>
			</div>
			{children}
		</dialog>
	);
}
