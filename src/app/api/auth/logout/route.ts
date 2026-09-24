import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/credits/session";

/** Clears the session cookie in this browser. A __Host- cookie is only replaced by one that is also Secure on path /. */
export async function POST() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/", secure: process.env.NODE_ENV === "production" });
  return new Response(null, { status: 204 });
}
