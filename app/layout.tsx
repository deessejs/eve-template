import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/app/_components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "eve-template",
  description: "A Next.js starter for eve agents with AI Elements.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    // `suppressHydrationWarning` is required when using `attribute="class"`
    // with next-themes — the theme is set on the html element on the
    // client, which would otherwise trigger a hydration warning.
    <html className={cn(sans.variable, mono.variable)} lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
