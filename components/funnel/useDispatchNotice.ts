"use client";

import { useSyncExternalStore } from "react";
import { dispatchNoticeAt, type DispatchNotice } from "@/config/funnel";

/**
 * The weekend dispatch notice (dispatchNoticeAt) as of the shopper's clock,
 * for the buy boxes' "order by 3pm" lines. Client-only, as the banner's
 * clock is: storefront pages are cached for five minutes, so a notice worked
 * out on the server could still be showing after 3pm on Friday, or missing
 * on Saturday morning. The server and the first client render get null (the
 * usual line), and the notice takes over after hydration in the same space.
 */

// Once a minute is fine: the notice changes twice a week.
function subscribe(onTick: () => void) {
  const t = setInterval(onTick, 60_000);
  return () => clearInterval(t);
}
const nowMinutes = () => Math.floor(Date.now() / 60_000);
const serverMinutes = () => null;

export function useDispatchNotice(): DispatchNotice | null {
  const minute = useSyncExternalStore(subscribe, nowMinutes, serverMinutes);
  return minute === null ? null : dispatchNoticeAt(new Date(minute * 60_000));
}
