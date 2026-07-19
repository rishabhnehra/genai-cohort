import { getConversation } from "@/features/conversations/actions";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    await getConversation(id);
  } catch (error) {
    console.error("Something went wrong", error);
    notFound();
  }

  return <h1>Dynamic page for id: {`${id}`}</h1>;
}
