"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FireService } from "@/lib/api/client";
import { client } from "@/lib/api/client/client.gen";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface IngestDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function IngestDialog({ open, onOpenChange }: IngestDialogProps) {
    const [businessUnitsFile, setBusinessUnitsFile] = useState<File | null>(null);
    const [managersFile, setManagersFile] = useState<File | null>(null);
    const [ticketsFile, setTicketsFile] = useState<File | null>(null);
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [cleanAllBeforeStart, setCleanAllBeforeStart] = useState(false);

    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async () => {
            if (!businessUnitsFile || !managersFile || !ticketsFile) {
                throw new Error("Выберите все 3 файла");
            }

            if (cleanAllBeforeStart) {
                await client.delete({ url: "/api/v1/fire/reset-all" });
            }

            return await FireService.ingestCsvFilesApiV1FireIngestPost({
                body: {
                    business_units: businessUnitsFile,
                    managers: managersFile,
                    tickets: ticketsFile ,
                    images: imageFiles,
                },
            });
        },
        onSuccess: () => {
            toast.success("Загрузка успешно запущена");
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["tickets"] });
            queryClient.invalidateQueries({ queryKey: ["ai-analytics"] });
            queryClient.invalidateQueries({ queryKey: ["managers"] });
            queryClient.invalidateQueries({ queryKey: ["business-units"] });
            onOpenChange(false);
            // Reset files
            setBusinessUnitsFile(null);
            setManagersFile(null);
            setTicketsFile(null);
            setImageFiles([]);
            setCleanAllBeforeStart(false);
        },
        onError: (error) => {
            toast.error(`Ingestion failed: ${error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Новая загрузка данных</DialogTitle>
                        <DialogDescription>
                            Загрузите 3 Требуемых CSV-файла для обработки данных.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="business-units">CSV бизнес-подразделений</Label>
                            <Input
                                id="business-units"
                                type="file"
                                accept=".csv"
                                onChange={(e) => setBusinessUnitsFile(e.target.files?.[0] || null)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="managers">CSV менеджеров</Label>
                            <Input
                                id="managers"
                                type="file"
                                accept=".csv"
                                onChange={(e) => setManagersFile(e.target.files?.[0] || null)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="tickets">CSV обращений</Label>
                            <Input
                                id="tickets"
                                type="file"
                                accept=".csv"
                                onChange={(e) => setTicketsFile(e.target.files?.[0] || null)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="images">Изображения (опционально, можно выбрать несколько)</Label>
                            <Input
                                id="images"
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                            />
                            {imageFiles.length > 0 ? (
                                <p className="text-xs text-muted-foreground">Выбрано изображений: {imageFiles.length}</p>
                            ) : null}
                        </div>

                        <div className="rounded-md border p-3">
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="clean-all-before-start"
                                    checked={cleanAllBeforeStart}
                                    onCheckedChange={(checked) => setCleanAllBeforeStart(Boolean(checked))}
                                />
                                <div className="grid gap-1">
                                    <Label htmlFor="clean-all-before-start" className="cursor-pointer">
                                        Очистить все данные FIRE перед запуском
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Удаляет задачи, логи, обращения, AI-анализ, маршруты, менеджеров и файлы, затем начинает новую загрузку.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isPending || !businessUnitsFile || !managersFile || !ticketsFile}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Обработка...
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="mr-2 h-4 w-4" />
                                    Начать
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
