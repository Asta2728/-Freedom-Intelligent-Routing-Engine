"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/auth-store";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const loginSchema = z.object({
    email: z.string().email("Введите корректный email."),
    password: z.string().min(1, "Пароль обязателен."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const login = useAuthStore((s) => s.login);

    const mutation = useMutation({
        mutationFn: (data: LoginFormValues) =>
            login({ username: data.email, password: data.password }),
        onSuccess: () => {
            toast.success("Вы успешно вошли.");
            router.push("/dashboard");
        },
        onError: () => {
            toast.error("Неверный email или пароль.");
        },
    });

    const { control, handleSubmit } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    function onSubmit(data: LoginFormValues) {
        mutation.mutate(data);
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4">
            <div className="w-full max-w-sm bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-xl p-8">
                <h1 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-zinc-100">Вход</h1>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FieldGroup>
                        <Controller
                            control={control}
                            name="email"
                            render={({ field, fieldState }) => (
                                <Field className="space-y-2">
                                    <Label htmlFor={field.name} className={fieldState.error ? "text-red-500" : ""}>
                                        Email
                                    </Label>
                                    <Input id={field.name} type="email" placeholder="имя@example.com" {...field} />
                                    {fieldState.error && (
                                        <p className="text-sm font-medium text-red-500 dark:text-red-900">
                                            {fieldState.error.message}
                                        </p>
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            control={control}
                            name="password"
                            render={({ field, fieldState }) => (
                                <Field className="space-y-2">
                                    <Label htmlFor={field.name} className={fieldState.error ? "text-red-500" : ""}>
                                        Пароль
                                    </Label>
                                    <Input id={field.name} type="password" placeholder="••••••••" {...field} />
                                    {fieldState.error && (
                                        <p className="text-sm font-medium text-red-500 dark:text-red-900">
                                            {fieldState.error.message}
                                        </p>
                                    )}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                    <Button type="submit" className="w-full" disabled={mutation.isPending}>
                        {mutation.isPending ? "Вход..." : "Войти"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
