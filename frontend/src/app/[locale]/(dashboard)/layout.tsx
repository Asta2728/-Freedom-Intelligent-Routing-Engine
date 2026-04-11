import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";
import { ReactNode } from "react";

export default async function DashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}