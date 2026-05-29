import type { Metadata } from "next";
import { Fraunces, Spline_Sans } from "next/font/google";
import "./globals.css";

// Display serif for headings + money figures; clean sans for everything else
// (docs/design-system.md §4). next/font self-hosts these and exposes them as
// CSS variables consumed by tailwind.config.ts (font-display / font-body).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const splineSans = Spline_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daily Expenses",
  description: "Expense tracking for UAE freelancers and small businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${splineSans.variable}`}
    >
      <body className="min-h-screen bg-paper font-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
