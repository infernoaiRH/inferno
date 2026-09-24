import { Hero } from "@/components/landing/Hero";
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

/** Each section answers one question a newcomer has, in the order they'd ask it. */
export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ChatShowcase />
      <BittensorSection />
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
