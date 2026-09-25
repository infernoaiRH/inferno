"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BadgeCheck, ChevronLeft, Lock, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";
import { ConnectCta } from "@/components/wallet/ConnectButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CHAIN } from "@/lib/chain";
import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import { useMounted } from "@/lib/useMounted";
import { newIdentity, open, safetyNumber, seal, signBinding, type Binding, type Envelope, type Identity } from "@/lib/seal";
import { SafetyNumber } from "./SafetyNumber";

type Id = "ada" | "ravi";
/** A contact as this browser knows them. `device` stands in for their phone: the demo seals their replies here. */
type Contact = { name: string; device: Identity; trusted: string[]; verified: string[] };
type World = { me: Identity; contacts: Record<Id, Contact>; threads: Record<Id, Envelope[]> };
type Status = "verified" | "sealed" | "changed";

const IDS: Id[] = ["ada", "ravi"];
const REPLIES: Record<Id, string[]> = {
  ada: ["Lovely. See you Thursday.", "Noted. I'll bring the programme.", "Ha, fair enough."],
  ravi: ["Thanks, that helps.", "Got it. I'll fold that in tonight.", "Perfect. Next draft by Friday."],
};

const MESSAGE: Record<Status, { label: string; tone: string; Icon: typeof Lock }> = {
  verified: { label: "Verified", tone: "text-mint", Icon: ShieldCheck },
  sealed: { label: "Sealed", tone: "text-hush", Icon: Lock },
  changed: { label: "New key, not verified", tone: "text-ember", Icon: TriangleAlert },
};
const CONTACT: Record<Status, string> = { verified: "Verified", sealed: "Not verified yet", changed: "Key changed" };

/** Keys trusted on this device decide every label; names never come from the relay. */
const statusOf = (c: Contact, key: string): Status =>
  c.verified.includes(key) ? "verified" : c.trusted.includes(key) ? "sealed" : "changed";

const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const pill = (on: boolean) =>
  cn(
    "h-9 rounded-full border px-3.5 text-sm transition-colors",
    on ? "border-moon/60 bg-moon/10 text-moon" : "border-line text-hush hover:border-line-bright hover:text-mist",
  );

function seed(): World {
  const me = newIdentity();
  const ada = newIdentity();
  const ravi = newIdentity();
  const ago = (min: number) => Date.now() - min * 60_000;
  return {
    me,
    contacts: {
      // Ada's safety number was compared earlier; Ravi's key is trusted on first use, not yet compared.
      ada: { name: "Ada", device: ada, trusted: [ada.pub], verified: [ada.pub] },
      ravi: { name: "Ravi", device: ravi, trusted: [ravi.pub], verified: [] },
    },
    threads: {
      ada: [
        seal("Are we still on for the recital on Thursday?", ada, me.pub, ago(52)),
        seal("Yes. Seven, by the side door.", me, ada.pub, ago(49)),
        seal("I'll save you a seat near the back.", ada, me.pub, ago(47)),
      ],
      ravi: [
        seal("Sent you the draft. Page three needs your eyes.", ravi, me.pub, ago(180)),
        seal("Reading it tonight.", me, ravi.pub, ago(172)),
      ],
    },
  };
}

/** The /messages demo inbox. Keys and history are made in the browser, so the server sends an empty frame. */
export function Inbox() {
  const mounted = useMounted();
  return mounted ? <InboxApp /> : <div className="h-full" aria-busy="true" />;
}

function InboxApp() {
  const [world, setWorld] = useState(seed);
  const [active, setActive] = useState<Id>("ada");
  const [showList, setShowList] = useState(false); // below lg: the list and the conversation take turns
  const [relayView, setRelayView] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const { me, contacts, threads } = world;
  const contact = contacts[active];
  const thread = threads[active];
  const status = statusOf(contact, contact.device.pub);
  const opened = useMemo(
    () =>
      thread.map((env) => {
        try {
          return open(env, me);
        } catch {
          return null;
        }
      }),
    [thread, me],
  );

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, active, relayView]);

  const post = (id: Id, env: Envelope) =>
    setWorld((w) => ({ ...w, threads: { ...w.threads, [id]: [...w.threads[id], env] } }));
  const updateContact = (f: (c: Contact) => Contact) =>
    setWorld((w) => ({ ...w, contacts: { ...w.contacts, [active]: f(w.contacts[active]) } }));

  function send(text: string) {
    const id = active;
    post(id, seal(text, me, contact.device.pub));
    const lines = REPLIES[id];
    const reply = seal(lines[thread.length % lines.length], contact.device, me.pub, Date.now() + 1200);
    setTimeout(() => post(id, reply), 1200);
  }

  function simulateKeyChange() {
    const device = newIdentity();
    const note = seal("New phone, same Ada. Can you resend the notes from Sunday?", device, me.pub);
    setWorld((w) => ({
      ...w,
      contacts: { ...w.contacts, ada: { ...w.contacts.ada, device } },
      threads: { ...w.threads, ada: [...w.threads.ada, note] },
    }));
    setActive("ada");
    setShowList(false);
    setRelayView(false);
  }

  function compare() {
    setSafetyOpen(true);
    scroller.current?.scrollTo({ top: 0 });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-night-2 px-5 py-2.5 text-sm text-hush sm:px-8">
        <p className="min-w-0 flex-1 basis-64">Demo relay: nothing leaves this browser yet.</p>
        <button type="button" onClick={simulateKeyChange} className={pill(false)}>
          Simulate a key change
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Conversations"
          className={cn("w-full flex-col overflow-y-auto lg:flex lg:w-80 lg:shrink-0 lg:border-r lg:border-line", showList ? "flex" : "hidden")}
        >
          <YouCard me={me} />
          <ul className="py-2">
            {IDS.map((id) => {
              const c = contacts[id];
              const s = statusOf(c, c.device.pub);
              const { Icon, tone } = MESSAGE[s];
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-current={id === active ? "true" : undefined}
                    onClick={() => {
                      setActive(id);
                      setShowList(false);
                      setSafetyOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-night-2",
                      id === active && "bg-night-2",
                    )}
                  >
                    <Avatar name={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{c.name}</span>
                      <span className={cn("flex items-center gap-1.5 text-sm", tone)}>
                        <Icon size={14} aria-hidden />
                        {CONTACT[s]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section
          aria-labelledby="thread-title"
          className={cn("min-w-0 flex-1 flex-col lg:flex", showList ? "hidden" : "flex")}
        >
          <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setShowList(true)}
              aria-label="All conversations"
              className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-hush transition-colors hover:text-mist lg:hidden"
            >
              <ChevronLeft size={20} />
            </button>
            <Avatar name={contact.name} />
            <div className="min-w-0 flex-1">
              <h2 id="thread-title" className="text-xl leading-tight">
                {contact.name}
              </h2>
              <p className={cn("text-sm", MESSAGE[status].tone)}>{CONTACT[status]}</p>
            </div>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <button
                type="button"
                aria-expanded={safetyOpen}
                aria-controls="safety-panel"
                onClick={() => setSafetyOpen((o) => !o)}
                className={pill(safetyOpen)}
              >
                Safety number
              </button>
              <button type="button" aria-pressed={relayView} onClick={() => setRelayView((v) => !v)} className={pill(relayView)}>
                What the relay sees
              </button>
            </div>
          </header>

          {status === "changed" && (
            <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ember/30 bg-ember/10 px-4 py-3 sm:px-6">
              <TriangleAlert size={18} className="shrink-0 text-ember" aria-hidden />
              <p className="min-w-0 flex-1 basis-56 text-[15px] font-medium text-ember">
                {contact.name}&apos;s key changed. Compare safety numbers before trusting new messages.
              </p>
              {!safetyOpen && (
                <button
                  type="button"
                  onClick={compare}
                  className="h-9 rounded-full border border-ember/50 px-3.5 text-sm text-ember transition-colors hover:bg-ember/10"
                >
                  Compare safety numbers
                </button>
              )}
            </div>
          )}

          <div
            ref={scroller}
            tabIndex={0}
            role="region"
            aria-label={`Conversation with ${contact.name}`}
            className="relative min-h-0 flex-1 overflow-y-auto"
          >
            {safetyOpen && (
              <section id="safety-panel" aria-labelledby="safety-title" className="border-b border-line bg-night-2/60 px-4 py-6 sm:px-6">
                <h3 id="safety-title" className="text-lg">
                  Your safety number with {contact.name}
                </h3>
                <SafetyNumber className="mt-4" value={safetyNumber(me.pub, contact.device.pub)} />
                <p className="mt-4 max-w-prose text-[15px] text-hush">
                  {status === "changed" && `This number changed with ${contact.name}'s new key. `}
                  {contact.name} sees the same 60 digits. Compare them in person or on a call you trust. If they match, no one
                  swapped a key between you.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {status === "verified" ? (
                    <Button
                      variant="quiet"
                      onClick={() => updateContact((c) => ({ ...c, verified: c.verified.filter((k) => k !== c.device.pub) }))}
                    >
                      Clear verification
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        updateContact((c) => ({
                          ...c,
                          trusted: [...c.trusted, c.device.pub],
                          verified: [...c.verified, c.device.pub],
                        }))
                      }
                    >
                      {status === "changed" ? "They match, trust the new key" : "Mark as verified"}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setSafetyOpen(false)}>
                    Close
                  </Button>
                </div>
              </section>
            )}

            {relayView ? (
              <div className="px-4 py-6 sm:px-6">
                <p className="max-w-prose text-[15px] text-hush">
                  Everything the relay holds for this conversation: keys, times and sealed bytes padded to 256-byte steps. No
                  names, no words.
                </p>
                <ol className="mt-4 flex flex-col gap-3">
                  {thread.map((env) => (
                    <li key={env.nonce}>
                      <pre className="rounded-2xl border border-line bg-night-2 p-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-hush">
                        {JSON.stringify(env, null, 2)}
                      </pre>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <ol aria-live="polite" className="flex flex-col gap-4 px-4 py-6 sm:px-6">
                {thread.map((env, i) => {
                  const mine = env.from === me.pub;
                  const s = statusOf(contact, mine ? env.to : env.from);
                  const { Icon, label, tone } = MESSAGE[s];
                  return (
                    <li
                      key={env.nonce}
                      className={cn("flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]", mine ? "items-end self-end" : "items-start self-start")}
                    >
                      <p
                        className={cn(
                          "rounded-3xl px-4 py-2.5 text-[15px] break-words whitespace-pre-wrap",
                          mine ? "rounded-br-lg bg-moon/15" : "rounded-bl-lg bg-night-3",
                          s === "changed" && "ring-1 ring-ember/60",
                        )}
                      >
                        <span className="sr-only">{mine ? "You" : contact.name}: </span>
                        {opened[i] ?? <span className="text-ember">This note was changed after it was sealed, so it won&apos;t open.</span>}
                      </p>
                      <p className={cn("flex items-center gap-1.5 text-xs", tone)}>
                        <Icon size={12} aria-hidden />
                        {label}
                        <time className="tnum text-faint" dateTime={new Date(env.ts).toISOString()}>
                          {clock(env.ts)}
                        </time>
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {status === "changed" ? (
            <p className="border-t border-line px-4 py-4 text-sm text-hush sm:px-6">
              Sending to {contact.name} is paused until you compare safety numbers.
            </p>
          ) : (
            <Composer key={active} name={contact.name} onSend={send} />
          )}
        </section>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-night-3 font-display text-lg text-moon">
      {name[0]}
    </span>
  );
}

/** You: a key made in this tab, optionally vouched for by the connected wallet. */
function YouCard({ me }: { me: Identity }) {
  const { address, provider, connected } = useWallet();
  const [binding, setBinding] = useState<Binding | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function bind() {
    if (!provider || !address) return;
    setBusy(true);
    setError(null);
    try {
      const signed = await signBinding(provider, address, me.pub, CHAIN.id);
      if (signed) setBinding(signed);
      else setError("That signature doesn't match your address, so the key wasn't bound.");
    } catch (e) {
      setError(
        (e as { code?: number }).code === 4001
          ? "You declined in your wallet, so nothing was bound."
          : "Your wallet didn't sign the key. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="you-title" className="border-b border-line p-5">
      <div className="flex items-center gap-3">
        <Avatar name="You" />
        <div className="min-w-0">
          <h2 id="you-title" className="text-lg leading-tight">
            You
          </h2>
          <p className="text-sm text-faint">Key {shortAddress(me.pub)}, made in this tab</p>
        </div>
      </div>
      {binding ? (
        <p
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-3 py-1 text-sm text-mint"
          title={binding.address}
        >
          <BadgeCheck size={15} aria-hidden />
          Bound to {shortAddress(binding.address)}
        </p>
      ) : connected ? (
        <>
          <p className="mt-4 text-sm text-hush">Sign once so people can tell this key is yours. No gas, and nothing moves.</p>
          <Button variant="quiet" className="mt-3" onClick={() => void bind()} disabled={busy}>
            {busy ? "Waiting for your wallet…" : "Sign my messaging key"}
          </Button>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm text-hush">Connect a wallet to vouch for this key.</p>
          <ConnectCta className={buttonClass({ variant: "quiet", className: "mt-3" })} />
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-ember">
          {error}
        </p>
      )}
    </section>
  );
}

function Composer({ name, onSend }: { name: string; onSend: (text: string) => void }) {
  const [draft, setDraft] = useState("");

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-line px-4 py-3 sm:px-6">
      <label htmlFor="composer" className="sr-only">
        Message to {name}
      </label>
      <textarea
        id="composer"
        rows={1}
        value={draft}
        maxLength={2000}
        placeholder={`Write to ${name}`}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        className="field-sizing-content max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-line bg-night-2 px-4 py-2.5 text-base transition-colors placeholder:text-faint hover:border-line-bright focus:border-moon/60 sm:text-[15px]"
      />
      <Button type="submit" disabled={!draft.trim()} className="h-11">
        Seal and send
      </Button>
    </form>
  );
}
