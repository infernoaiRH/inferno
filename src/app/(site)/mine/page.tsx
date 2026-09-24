import { redirect } from "next/navigation";

/** /mine is the short name for the Mine page, which lives at /lend. */
export default function MinePage() {
  redirect("/lend");
}
