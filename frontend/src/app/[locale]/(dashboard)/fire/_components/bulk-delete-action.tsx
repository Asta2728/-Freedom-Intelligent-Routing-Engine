"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface BulkDeleteActionProps {
    selectedIds: string[];
    onSuccess?: () => void;
    mutationFn: (ids: string[]) => Promise<unknown>;
    entityName: string;
    queryKey: string[];
}

export function BulkDeleteAction({
    selectedIds,
    onSuccess,
    mutationFn,
    entityName,
    queryKey,
}: BulkDeleteActionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => mutationFn(selectedIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
                toast.success(`Удалено ${selectedIds.length} ${entityName}`);
            onSuccess?.();
            setIsOpen(false);
        },
        onError: (error) => {
            console.error(`Bulk delete error for ${entityName}:`, error);
            toast.error(`Ошибка удаления. Повторите попытку.`);
        },
    });

    if (selectedIds.length === 0) return null;

    return (
        <>
            <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-2"
                onClick={() => setIsOpen(true)}
            >
                <Trash2 className="h-4 w-4" />
                Удалить выбранные ({selectedIds.length})
            </Button>

            <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Вы действительно уверены?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Это действие нельзя отменить. Будут навсегда удалены {selectedIds.length} {entityName} из базы данных.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={mutation.isPending}>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                mutation.mutate();
                            }}
                            disabled={mutation.isPending}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Удалить
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
