import type { Metadata } from "next";
import { Hero } from "@/components/landing/Hero";
import { SubnetStrip } from "@/components/landing/SubnetStrip";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ChatShowcase } from "@/components/landing/ChatShowcase";
import { BittensorSection } from "@/components/landing/BittensorSection";
import { LendTeaser } from "@/components/landing/LendTeaser";
import { ChainSection } from "@/components/landing/ChainSection";
import { Pricing } from "@/components/landing/Pricing";
import { WhoHears } from "@/components/landing/WhoHears";
import { SealDemo } from "@/components/seal/SealDemo";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";

// The site also answers on its vercel.app address; this points search engines at the real one.
export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Each section answers one question a newcomer has, in the order they'd ask it. */
export default function Home() {
  return (
    <>
      <Hero />
      <SubnetStrip />
      <BittensorSection />
      <HowItWorks />
      <ChatShowcase />
      <LendTeaser />
      <ChainSection />
      <Pricing />
      <WhoHears />
      <SealDemo />
      <Faq />
      <FinalCta />
    </>
  );
}
