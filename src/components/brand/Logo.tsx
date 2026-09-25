import Image from "next/image";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";
import logo from "./logo.png";

/**
 * The Inferno dragon, cut out of the designer's artwork. The same logo.png feeds the share image
 * (src/app/opengraph-image.tsx); src/app/icon.png and apple-icon.png are sized copies of it.
 */
export function LogoMark({ className }: { className?: string }) {
  return <Image src={logo} alt="" width={64} loading="eager" className={cn("object-contain", className)} />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-10 w-10" />
      <span className="wide font-display text-[1.35rem] leading-none font-extrabold tracking-tight">{site.wordmark}</span>
    </span>
  );
}
