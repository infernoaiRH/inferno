import Link from "next/link";
import { site } from "@/lib/site";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

/** Renders in the root layout only (no Nav or Footer), so it carries its own way home. */
export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-7xl flex-col px-5 sm:px-8">
      <Link href="/" aria-label={`${site.name} home`} className="mt-4 flex h-12 items-center self-start">
        <Logo />
      </Link>
      <div className="my-auto py-24">
        <p aria-hidden className="xwide heat-text font-display text-[clamp(5rem,20vw,12rem)] leading-none font-black">
          404
        </p>
        <h1 className="wide mt-6 max-w-[16ch] text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] font-black">
          This page went cold.
        </h1>
        <p className="mt-6 max-w-[48ch] text-lg text-hush">It doesn&apos;t exist, or it moved.</p>
        <ButtonLink href="/" size="lg" className="mt-10">
          Back to the home page
        </ButtonLink>
      </div>
    </main>
  );
}
