"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm, Controller } from "react-hook-form";
import { FieldGroup, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { registerApiV1AuthRegisterPostMutation } from "@/lib/api/client/@tanstack/react-query.gen";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const registerSchema = z.object({
    firstName: z.string().min(2, "Имя должно содержать не менее 2 символов."),
    lastName: z.string().min(2, "Фамилия должна содержать не менее 2 символов."),
    email: z.string().email("Введите корректный email."),
    password: z.string().min(8, "Пароль должен содержать не менее 8 символов."),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const router = useRouter();

    const mutation = useMutation({
        ...registerApiV1AuthRegisterPostMutation(),
        onSuccess: (data) => {
            toast.success("Аккаунт создан! Войдите в систему.");
            // Redirect to login page
            router.push("/auth/login");
        },
        onError: (error) => {
            console.error(error);
            toast.error("Ошибка регистрации. Аккаунт уже существует.");
        }
    });

    const { control, handleSubmit } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            password: "",
        },
    });

    function onSubmit(data: RegisterFormValues) {
        // Ensure payload shapes align with UserCreate payload
        mutation.mutate({
            body: {
                email: data.email,
                password: data.password,
                full_name: `${data.firstName} ${data.lastName}`.trim(),
            }
        });
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4">
            <div className="w-full max-w-sm bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800 rounded-xl p-8">
                <h1 className="text-2xl font-bold mb-6 text-center text-zinc-900 dark:text-zinc-100">Регистрация</h1>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FieldGroup>
                        <Controller
                            control={control}
                            name="firstName"
                            render={({ field, fieldState }) => (
                                <Field className="space-y-2">
                                    <Label htmlFor={field.name} className={fieldState.error ? "text-red-500" : ""}>
                                        Имя
                                    </Label>
                                    <Input id={field.name} placeholder="Иван" {...field} />
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
                            name="lastName"
                            render={({ field, fieldState }) => (
                                <Field className="space-y-2">
                                    <Label htmlFor={field.name} className={fieldState.error ? "text-red-500" : ""}>
                                        Фамилия
                                    </Label>
                                    <Input id={field.name} placeholder="Иванов" {...field} />
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
                        {mutation.isPending ? "Создание..." : "Зарегистрироваться"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
