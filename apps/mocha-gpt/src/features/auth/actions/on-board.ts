"use server";

import { prisma } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";

export async function onBoard() {
  const user = await currentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  return prisma.user.upsert({
    where: {
      clerkId: user.id,
    },
    create: {
      clerkId: user.id,
      email: user.emailAddresses[0].emailAddress ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    },
    update: {
      email: user.emailAddresses[0].emailAddress ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    },
  });
}
