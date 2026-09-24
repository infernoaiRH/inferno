import { Nav } from "@/components/site/Nav";

/** Full-height app chrome for /chat and /messages: compact nav, no footer. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <Nav variant="app" />
      <main id="main" className="min-h-0 flex-1">
        {children}
      </main>
    </div>
  );
}
