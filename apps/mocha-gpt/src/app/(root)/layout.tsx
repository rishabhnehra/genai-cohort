import { onBoard } from "@/features/auth/actions/on-board";
import { auth } from "@clerk/nextjs/server";
import type { PropsWithChildren } from "react";

export default async function RootGroupLayout(props: PropsWithChildren) {
  await auth.protect();
  await onBoard();

  return <div>{props.children}</div>;
}
