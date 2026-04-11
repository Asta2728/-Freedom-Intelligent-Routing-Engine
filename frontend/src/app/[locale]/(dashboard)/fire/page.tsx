import { redirect } from "next/navigation";

export default async function FirePage() {
    redirect("/fire/tasks");
}
