import { ButtonLink } from "@/components/ui/Button";

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="relative overflow-hidden">
      {/* A low ember glow from the bottom corner, like a card still warm from work. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_100%,color-mix(in_oklab,var(--color-heat-2)_45%,transparent),transparent_60%)]"
      />
      <div className="relative mx-auto max-w-7xl px-5 pt-24 pb-8 sm:px-8 sm:pt-32">
        <h2 id="final-title" className="xwide max-w-[14ch] text-[clamp(2.25rem,8vw,7rem)] leading-[0.92] font-black">
          <span className="heat-text">Put a GPU to work.</span> Or ask one something.
        </h2>
        <div className="mt-12 flex flex-wrap gap-3">
          <ButtonLink href="/chat" size="lg">
            Start chatting
          </ButtonLink>
          <ButtonLink href="/lend" size="lg" variant="quiet">
            Mine with your GPU
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
