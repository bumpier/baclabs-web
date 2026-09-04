import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* First in the tab order on every storefront page. Off screen until
          focused, so it costs sighted users nothing and saves keyboard and
          screen-reader users the header on every single page. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
