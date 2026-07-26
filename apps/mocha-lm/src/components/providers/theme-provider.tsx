"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

function isNextThemesScriptWarning(args: unknown[]) {
  return args.some((arg) => {
    if (typeof arg === "string") {
      return arg.includes("Encountered a script tag");
    }
    if (arg instanceof Error) {
      return arg.message.includes("Encountered a script tag");
    }
    return false;
  });
}

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (isNextThemesScriptWarning(args)) {
      return;
    }
    originalError.apply(console, args);
  };
}

/**
 * next-themes injects an inline <script> to avoid theme flash before hydration.
 * React 19 warns about script tags rendered inside client components; the
 * script still runs correctly during SSR, so we filter that specific warning.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
