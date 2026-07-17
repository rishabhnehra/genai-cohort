import Image from "next/image";
import { ModeToggle } from "@/components/ui/toggle-mode";
import { UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div>
      <ModeToggle />
      <UserButton />
    </div>
  );
}
