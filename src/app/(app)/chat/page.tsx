import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/ChatApp";

export const metadata: Metadata = { title: "Chat", alternates: { canonical: "/chat" } };

export default function ChatPage() {
  return (
    <>
      <h1 className="sr-only">Chat</h1>
      <ChatApp />
    </>
  );
}
