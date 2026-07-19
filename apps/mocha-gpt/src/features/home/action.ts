"use server";

import { prisma } from "@/lib/db";
import { requiredUser } from "../auth/actions/required-user";

export async function startNewChat() {
  const user = await requiredUser();

  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: "New Chat",
    },
  });

  return conversation.id;
}
