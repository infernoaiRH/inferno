import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { LiveBar } from "@/components/site/LiveBar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LiveBar />
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
