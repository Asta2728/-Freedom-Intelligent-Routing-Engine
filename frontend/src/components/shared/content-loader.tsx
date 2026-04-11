"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ContentLoaderProps {
    rows?: number;
    withCard?: boolean;
    className?: string;
}

export function ContentLoader({
    rows = 3,
    withCard = true,
    className
}: ContentLoaderProps) {
    const content = (
        <div className={cn("space-y-6", !withCard && className)}>
            <div className="space-y-4">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-20" /> {/* Label/Title */}
                        <Skeleton className="h-10 w-full" /> {/* Input/Main Content */}
                        <Skeleton className="h-3 w-40" /> {/* Description/Subtitle */}
                    </div>
                ))}
            </div>
            <Skeleton className="h-10 w-full" /> {/* Action Button/Footer */}
        </div>
    );

    if (!withCard) return content;

    return (
        <Card className={cn("border-zinc-200 dark:border-zinc-800", className)}>
            <CardHeader className="space-y-2">
                <Skeleton className="h-6 w-32" /> {/* Card Header Title */}
                <Skeleton className="h-4 w-48" /> {/* Card Header Subtitle */}
            </CardHeader>
            <CardContent>{content}</CardContent>
        </Card>
    );
}
