"use client";
import { useState } from "react";
import type { Identity } from "../lib/contract";
import { Login } from "../components/login";
import { Workspace } from "../components/workspace";

export default function Home() {
	const [identity, setIdentity] = useState<Identity | null>(null);
	return (
		<>
			<header className="topbar">
				<a href="/" className="brand">
					<span className="brand-mark">IT</span>
					<span>
						ITMS<small>Equipment requests</small>
					</span>
				</a>
				<span className="environment">พื้นที่ทำงาน</span>
			</header>
			{identity ? (
				<Workspace
					key={identity.email}
					identity={identity}
					onLogout={() => {
						window.history.replaceState(
							null,
							"",
							`${window.location.pathname}${window.location.hash}`,
						);
						setIdentity(null);
					}}
				/>
			) : (
				<Login onLogin={setIdentity} />
			)}
			<footer>
				IT Equipment Request Management · เวลาที่แสดงตาม Asia/Bangkok
			</footer>
		</>
	);
}
