"use client";

import { CookieBanner } from "@/components/commerce/CookieBanner";
import { COOKIES } from "@/brands/gym/copy/site";

/**
 * The kit's cookie banner in the brand's look and words. Client-side
 * because its body is a function of the companies it names, and a server
 * layout cannot hand a function to a client component. The rules are the
 * kit's, untouched: nothing loads before Accept, and Reject and Accept share
 * one class, so refusing is never the weaker button. Above the phone's buy
 * bar (z-50), so the question is never hidden behind it.
 */
export function GymCookieBanner({ ga4Id }: { ga4Id: string | null }) {
  return (
    <CookieBanner
      ga4Id={ga4Id}
      className="no-print fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
      classNames={{
        panel: "gym-cookie",
        heading: "gym-cookie-heading",
        text: "gym-cookie-text",
        link: "gym-link",
        actions: "gym-cookie-actions",
        button: "gym-btn gym-btn-ghost flex-1",
      }}
      copy={{ heading: COOKIES.heading, body: COOKIES.body, reject: COOKIES.reject, accept: COOKIES.accept }}
    />
  );
}
