import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dirham",
  description: "Expense tracking for UAE freelancers and small businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
