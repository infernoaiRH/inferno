import { answer } from "@/lib/bittensor/answer";

/** Vercel ends this function after 5 minutes. An answer is cut off, and settled, before that (lib/bittensor/answer.ts). */
export const maxDuration = 300;

/**
 * The Inferno API: OpenAI's chat completions, answered by sealed models on Bittensor subnet 64 and
 * paid from the credits of the wallet behind `Authorization: Bearer inf_…` (keys are made on /credits).
 */
export function POST(req: Request) {
  return answer(req, true);
}
