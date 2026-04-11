import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl">Добро пожаловать в Datasaur FIRE</CardTitle>
          <p className="text-muted-foreground">
            Рабочее пространство для AI-анализа и маршрутизации обращений.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard">Перейти на главную</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/auth/login">Войти</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
