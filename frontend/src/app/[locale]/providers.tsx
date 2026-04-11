"use client";

import NiceModalContext from "@/components/nice-modal/modal-context";
import { Toaster } from "@/components/ui/sonner";
import { NextIntlClientProvider, AbstractIntlMessages } from "next-intl";
import NextTopLoader from "nextjs-toploader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { setupApiClient } from "@/lib/api/client-setup";

setupApiClient();

export const Providers = ({
    children,
    locale,
    messages
}: {
    children: React.ReactNode;
    locale: string;
    messages: AbstractIntlMessages;
}) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        refetchOnWindowFocus: false,
                        retry: 1,
                    },
                },
            }),
    );
    return (
        <QueryClientProvider client={queryClient}>
            <NextIntlClientProvider locale={locale} messages={messages}>
                <NextTopLoader showSpinner={false} />
                <Toaster />
                <NiceModalContext.Provider>{children}</NiceModalContext.Provider>
            </NextIntlClientProvider>
        </QueryClientProvider>
    );
};