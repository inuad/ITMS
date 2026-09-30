import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
	title: "ITMS · คำขออุปกรณ์ IT",
	description: "ระบบจัดการคำขอใช้อุปกรณ์ IT",
};
export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="th">
			<body>{children}</body>
		</html>
	);
}
