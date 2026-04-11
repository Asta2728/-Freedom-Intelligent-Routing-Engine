"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { toast } from "sonner";

type NestedAnalysis = {
    ai_type?: string | null;
    ai_tone?: string | null;
    ai_priority?: number | null;
    ai_language?: string | null;
    ai_summary?: string | null;
    ai_recommendation?: string | null;
};

type NestedManager = {
    full_name?: string | null;
    role?: string | null;
};

type NestedRouting = {
    justification?: string | null;
    routing_error?: string | null;
};

type ExportRow = Record<string, unknown> & {
    ai_analysis?: NestedAnalysis | null;
    assigned_manager?: NestedManager | null;
    routing_result?: NestedRouting | null;
};

interface AdvancedExportButtonProps {
    data: ExportRow[];
    filename?: string;
}

export function AdvancedExportButton({ data, filename = "export" }: AdvancedExportButtonProps) {

    // Format complex nested objects (like AI analysis or assigned manager) to strings
    const flattenData = (items: ExportRow[]) => {
        return items.map(item => {
            const flat: Record<string, unknown> = { ...item };

            if (item.ai_analysis) {
                flat.ai_type = item.ai_analysis.ai_type;
                flat.ai_tone = item.ai_analysis.ai_tone;
                flat.ai_priority = item.ai_analysis.ai_priority;
                flat.ai_language = item.ai_analysis.ai_language;
                flat.ai_summary = item.ai_analysis.ai_summary;
                flat.ai_recommendation = item.ai_analysis.ai_recommendation;
                delete flat.ai_analysis;
            }

            if (item.assigned_manager) {
                flat.manager_name = item.assigned_manager.full_name;
                flat.manager_role = item.assigned_manager.role;
                delete flat.assigned_manager;
            }

            if (item.routing_result) {
                flat.routing_justification = item.routing_result.justification;
                flat.routing_error = item.routing_result.routing_error;
                delete flat.routing_result;
            }

            return flat;
        });
    };

    const handleExportCSV = () => {
        try {
            if (!data || data.length === 0) {
                toast.error("No data available to export");
                return;
            }

            const flattened = flattenData(data);
            const worksheet = XLSX.utils.json_to_sheet(flattened);
            const csv = XLSX.utils.sheet_to_csv(worksheet);

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `${filename}.csv`);
            link.style.visibility = "hidden";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success("Successfully exported CSV");
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Failed to export CSV");
        }
    };

    const handleExportExcel = () => {
        try {
            if (!data || data.length === 0) {
                toast.error("No data available to export");
                return;
            }

            const flattened = flattenData(data);
            const worksheet = XLSX.utils.json_to_sheet(flattened);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

            XLSX.writeFile(workbook, `${filename}.xlsx`);
            toast.success("Successfully exported Excel");
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Failed to export Excel");
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 ml-auto flex items-center">
                    <Download className="mr-2 h-4 w-4" />
                    Advanced Export
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
                <DropdownMenuItem onClick={handleExportCSV}>
                    Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                    Export as Excel
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
