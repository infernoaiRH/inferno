import type { Metadata } from "next";
import { Inbox } from "@/components/seal/Inbox";

export const metadata: Metadata = { title: "Sealed messages", alternates: { canonical: "/messages" } };

export default function MessagesPage() {
  return (
    <>
      <h1 className="sr-only">Sealed messages</h1>
      <Inbox />
    </>
  );
}
