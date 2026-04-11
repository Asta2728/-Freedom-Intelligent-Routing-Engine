"use client";

import type * as React from "react";
import { ThemeProvider } from "next-themes";

interface Props {
    children: React.ReactNode;
    [key: string]: unknown;
}

export function NextThemeProvider({ children, ...props }: Props) {
    return <ThemeProvider {...props}>{children}</ThemeProvider>;
}