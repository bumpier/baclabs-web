import type { Metadata } from "next";

// No canonical: without the override this layout inherits the root
// layout's `/` canonical, telling crawlers a noindexed page is a copy of the
// home page — two contradictory signals on one URL.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function OrderConfirmationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
