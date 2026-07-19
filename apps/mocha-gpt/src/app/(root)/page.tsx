import { startNewChat } from "@/features/home/action";
import { redirect } from "next/navigation";

export default async function Home() {
  const conversationId = await startNewChat();

  redirect(`/c/${conversationId}`);
}
