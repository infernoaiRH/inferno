import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "quiet" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-300 ease-quiet active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-moon text-night hover:bg-mist",
  quiet: "border border-line-bright text-mist hover:border-moon hover:text-moon",
  ghost: "text-hush hover:text-mist",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-5 text-[15px]",
  lg: "h-12 px-7 text-base",
};

type Common = { variant?: Variant; size?: Size; className?: string };

export function buttonClass({ variant = "primary", size = "md", className }: Common = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({ variant, size, className, ...props }: Common & ComponentProps<"button">) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: Common & ComponentProps<typeof Link>) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}
