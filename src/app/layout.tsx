import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stay.WitUS", template: "%s | Stay.WitUS" },
  description:
    "Hotel websites with booking, concierge, and guest messaging. A WitUS platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-white text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
