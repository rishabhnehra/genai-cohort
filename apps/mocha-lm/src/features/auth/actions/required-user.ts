"use server";

import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

export async function requiredUser() {
  const { userId } = await auth.protect();

  const user = await prisma.user.findUnique({
    where: {
      clerkId: userId,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
