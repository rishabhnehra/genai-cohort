import { onBoard } from "@/features/auth/actions/on-board";
import { ChatShell } from "@/features/conversations/components/chat-shell";
import { auth } from "@clerk/nextjs/server";
import type { PropsWithChildren } from "react";

export default async function RootGroupLayout(props: PropsWithChildren) {
  await auth.protect();
  await onBoard();

  return (
    <ChatShell>
      <div>{props.children}</div>
    </ChatShell>
  );
}
