"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Wraps next-themes's ThemeProvider. Defaults chosen for shadcn:
 *
 * - attribute="class"        — shadcn's @custom-variant `dark (&:is(.dark *))`
 *                              targets `.dark` on the html element, so the
 *                              theme is applied as a class (not data-theme).
 * - defaultTheme="system"    — respects the OS preference on first load.
 * - enableSystem             — required for the system theme to track live
 *                              changes (e.g. user flips OS dark mode).
 * - disableTransitionOnChange — the app is small enough that we don't need
 *                              a 200ms theme fade; this avoids a flash on
 *                              hot reloads.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
