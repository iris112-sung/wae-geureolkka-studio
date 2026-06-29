import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "왜그럴까 스튜디오",
  description: "일상 심리, 인간관계, 소비 습관 숏츠 제작 워크플로우"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
