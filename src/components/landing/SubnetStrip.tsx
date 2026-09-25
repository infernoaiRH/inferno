"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Tau } from "@/components/brand/Tau";
import { useSubnet } from "@/lib/bittensor/useSubnet";
import { formatUsd } from "@/lib/format";
import type { ChutesModel } from "@/lib/bittensor/chutes";

const perMillion = (usd: number) => formatUsd(usd, usd >= 0.1 ? 2 : 4);

/** The band under the hero: subnet 64's live sealed models and Chutes' own prices, scrolling past. */
export function SubnetStrip() {
  const { models, loading } = useSubnet();
  const [paused, setPaused] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  // Pauses the marquee offscreen, in a hidden tab, while the pointer rests on the moving list (`zone`, which
  // leaves out the toggle so Play works at once), or when toggled. Written straight to the DOM, no re-render.
  useEffect(() => {
    const zoneEl = zone.current;
    const trackEl = track.current;
    if (!zoneEl || !trackEl) return;
    let offscreen = true;
    let hovering = false;
    const update = () => {
      trackEl.dataset.paused = String(
        paused || offscreen || document.hidden || hovering,
      );
    };
    const io = new IntersectionObserver(([e]) => {
      offscreen = !e.isIntersecting;
      update();
    });
    io.observe(zoneEl);
    const onEnter = () => {
      hovering = true;
      update();
    };
    const onLeave = () => {
      hovering = false;
      update();
    };
    zoneEl.addEventListener("pointerenter", onEnter);
    zoneEl.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      io.disconnect();
      zoneEl.removeEventListener("pointerenter", onEnter);
      zoneEl.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", update);
    };
  }, [models, paused]);

  return (
    <div className="border-y border-line bg-night-2/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:gap-8 sm:px-8">
        <p className="flex shrink-0 items-center gap-2 text-[15px] text-mist">
          <Tau className="text-heat-4" />
          Live on Bittensor subnet 64
        </p>
        {loading ? (
          <p className="text-[15px] text-hush">
            Asking subnet 64 which models are live…
          </p>
        ) : models === null ? (
          <p className="text-[15px] text-hush">
            Chutes&apos; model list didn&apos;t load. The chat asks again when
            you open it.
          </p>
        ) : models.length === 0 ? (
          <p className="text-[15px] text-hush">
            Chutes lists no sealed models right now.
          </p>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-3">
              <div
                ref={zone}
                className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)] motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]"
              >
                <div
                  ref={track}
                  className="animate-marquee flex w-max items-center gap-8 pr-8 data-[paused=true]:[animation-play-state:paused]"
                  style={{ animationDuration: `${models.length * 6}s` }}
                >
                  <ModelSpans models={models} />
                  <div aria-hidden className="contents motion-reduce:hidden">
                    <ModelSpans models={models} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                aria-label={
                  paused ? "Play the model list" : "Pause the model list"
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-bright text-hush transition-colors hover:text-mist motion-reduce:hidden"
              >
                {paused ? (
                  <Play aria-hidden size={16} />
                ) : (
                  <Pause aria-hidden size={16} />
                )}
              </button>
            </div>
            <p className="mt-2 text-[13px] text-hush">
              Chutes&apos; own prices per million tokens, read live. Only models
              in sealed hardware are listed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** One pass of the model list: name, price, a decorative τ separator. Rendered twice for a seamless loop. */
function ModelSpans({ models }: { models: ChutesModel[] }) {
  return (
    <>
      {models.map((m, i) => (
        <Fragment key={i}>
          <span className="whitespace-nowrap">
            <span className="text-mist">{m.name}</span>{" "}
            <span className="tnum text-hush">
              {perMillion(m.input)} in, {perMillion(m.output)} out
            </span>
          </span>
          <Tau className="text-heat-3 shrink-0" />
        </Fragment>
      ))}
    </>
  );
}
