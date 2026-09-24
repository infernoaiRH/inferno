import { after } from "next/server";
import { clientIp, isKey, refuse, relayStore } from "@/lib/relay/server";

export const dynamic = "force-dynamic";
// Serverless hosts cut a function off at this many seconds; each stream ends itself a little sooner.
export const maxDuration = 300;

/** How long one stream stays open, how long each read of the inbox waits, and the unread bytes one listener may leave queued. */
const LIFETIME_MS = 290_000;
const WAIT_MS = 10_000;
const MAX_UNREAD_BYTES = 1024 * 1024;
/** A stream id: milliseconds, then a counter (each fits the 64 bits Redis allows). */
const STREAM_ID = /^\d{1,19}-\d{1,19}$/;

/**
 * Server-sent events carrying every sealed envelope addressed to `?key=`, for the key's holder only:
 * `id` and `proof` must answer a fresh challenge from /api/relay/challenge for that key.
 *
 * The first event, `ready`, carries the stream's starting id, and every envelope carries its own.
 * After about 290 s a `bye` event ends the stream. Reconnecting with `?after=` (or Last-Event-ID)
 * set to the last id seen picks up exactly there: envelopes sent in between wait in the inbox.
 */
export async function GET(req: Request) {
  const store = relayStore();
  if (store instanceof Response) return store;
  const q = new URL(req.url).searchParams;
  const key = q.get("key");
  if (!isKey(key)) return refuse(400, "Expected ?key= with a 32-byte base64url public key.");
  const resume = req.headers.get("last-event-id") || q.get("after") || undefined;
  if (resume && !STREAM_ID.test(resume)) return refuse(400, "Expected ?after= with an id this stream sent.");
  if (!(await store.redeem(q.get("id") ?? "", key, q.get("proof") ?? ""))) {
    return refuse(403, "That proof doesn't answer a fresh challenge for this key. Ask for a new one.");
  }
  const l = await store.open(clientIp(req), key, resume);
  if (l === "full") return refuse(503, "The relay is full right now. Try again in a minute.", 30);
  if (l === "busy") return refuse(429, "Too many open streams from your network or for this key.", 15);

  // Freeing the slot has to finish even after the response ends: serverless hosts freeze the function then.
  let cleaned = () => {};
  after(new Promise<void>((resolve) => (cleaned = resolve)));
  const enc = new TextEncoder();
  let finish: (gone: boolean, error?: Error) => void = () => {};
  const stream = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        let done = false;
        finish = (gone, error) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          void l.close(gone).catch(() => {}).finally(cleaned);
          try {
            if (error) controller.error(error);
            else controller.close();
          } catch {
            // already closed
          }
        };
        const send = (s: string) => {
          if (done) return;
          try {
            controller.enqueue(enc.encode(s));
          } catch {
            return finish(true);
          }
          // A listener that stops reading would make the server hold everything sent to it. Drop it instead.
          if ((controller.desiredSize ?? 0) < -MAX_UNREAD_BYTES) finish(true, new Error("listener stopped reading"));
        };
        // Ending here, before the host cuts it off, lets the client reconnect at once and lose nothing.
        const timer = setTimeout(() => {
          send("event: bye\ndata: reconnect\n\n");
          finish(false);
        }, LIFETIME_MS);
        req.signal.addEventListener("abort", () => finish(true));
        send(`event: ready\nid: ${l.last}\ndata: ${l.last}\n\n`);

        void (async () => {
          let touched = Date.now();
          try {
            while (!done) {
              if (Date.now() - touched >= WAIT_MS) {
                touched = Date.now();
                await l.touch();
              }
              const got = await l.read(WAIT_MS);
              for (const e of got) send(`id: ${e.id}\ndata: ${e.data}\n\n`);
              if (!got.length) send(": ping\n\n");
            }
          } catch {
            finish(false); // the store failed; the client reconnects and resumes
          }
        })();
      },
      cancel() {
        finish(true);
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: 256 * 1024 }),
  );

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
