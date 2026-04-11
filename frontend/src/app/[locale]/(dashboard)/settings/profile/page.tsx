"use client";

import { ContentLoader } from "@/components/shared/content-loader";
import { Button } from "@/components/ui/button";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    readCurrentUserApiV1UsersMeGetOptions,
    updateCurrentUserApiV1UsersMePatchMutation,
} from "@/lib/api/client/@tanstack/react-query.gen";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const profileSchema = z.object({
                    full_name: z.string().min(2, "Полное имя должно содержать не менее 2 символов."),
    email: z.string().email("Введите корректный email."),
    bio: z
        .string()
        .max(500, "Био должно быть не более 500 символов.")
        .optional()
        .nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {

    const {
        data: userData,
        isLoading,
        refetch,
    } = useQuery({
        ...readCurrentUserApiV1UsersMeGetOptions(),
    });

    const updateMutation = useMutation({
        ...updateCurrentUserApiV1UsersMePatchMutation(),
        onSuccess: (data) => {
            toast.success("Профиль успешно обновлён.");
            // TODO: add invalidation of user query for profile context
            refetch();
        },
        onError: () => {
            toast.error("Ошибка обновления профиля.");
        },
    });

    const { control, handleSubmit, reset } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: { full_name: "", email: "", bio: "" },
        mode: "onSubmit",
    });

    useEffect(() => {
        if (userData) {
            reset({
                full_name: userData.full_name ?? "",
                email: userData.email ?? "",
                bio: userData.bio ?? "",
            });
        }
    }, [userData, reset]);

    function onSubmit(data: ProfileFormValues) {
        updateMutation.mutate({
            body: {
                full_name: data.full_name,
                email: data.email,
                bio: data.bio ?? null,
            },
        });
    }

    if (isLoading) {
        return <ContentLoader rows={3} withCard={false} />;
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <FieldGroup className="grid gap-6 md:grid-cols-2">
                <Controller
                    name="full_name"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="full_name">Полное имя</FieldLabel>
                            <FieldContent>
                                <Input
                                    id="full_name"
                                    placeholder="Иван Иванов"
                                    aria-invalid={fieldState.invalid}
                                    {...field}
                                />
                                <FieldDescription>
                                    Ваше публичное имя в системе.
                                </FieldDescription>
                                <FieldError errors={[fieldState.error]} />
                            </FieldContent>
                        </Field>
                    )}
                />

                <Controller
                    name="email"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="email">Адрес электронной почты</FieldLabel>
                            <FieldContent>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="ivan@example.com"
                                    aria-invalid={fieldState.invalid}
                                    readOnly
                                    {...field}
                                />
                                <FieldDescription>
                                    Email используется для входа в систему.
                                </FieldDescription>
                                <FieldError errors={[fieldState.error]} />
                            </FieldContent>
                        </Field>
                    )}
                />
            </FieldGroup>

            <Controller
                name="bio"
                control={control}
                render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="bio">О себе</FieldLabel>
                        <FieldContent>
                            <Textarea
                                id="bio"
                                placeholder="Немного о себе..."
                                className="min-h-[100px] resize-none"
                                aria-invalid={fieldState.invalid}
                                {...field}
                                value={field.value ?? ""}
                            />
                            <FieldDescription>
                                    Краткое описание для профиля (макс. 500 символов).
                            </FieldDescription>
                            <FieldError errors={[fieldState.error]} />
                        </FieldContent>
                    </Field>
                )}
            />

            <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Сохранение..." : "Обновить профиль"}
            </Button>
        </form>
    );
}
