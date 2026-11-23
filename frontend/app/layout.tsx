import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// next/font downloads Inter at build time and self-hosts it, so no runtime
// request goes to Google Fonts.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FitPal — Indian Nutrition & PPL Tracker",
  description:
    "Personal fitness and nutrition tracker: calories, protein, 7-day Indian meal plan, progress and PPL workouts.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
