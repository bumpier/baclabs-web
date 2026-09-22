"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ORDER_SCAN_PREFIX } from "@/lib/inventory/codes";
import type { PickView } from "@/lib/inventory/picking";
import {
  markPackedAction,
  openPickListAction,
  recordScanAction,
  resetPicksAction,
} from "@/app/admin/orders/scan/actions";

type Tone = "idle" | "good" | "bad" | "complete";

const PANEL: Record<Tone, string> = {
  idle: "bg-brand-tint text-brand-deep",
  good: "bg-emerald-600 text-white",
  bad: "bg-red-600 text-white",
  complete: "bg-brand-deep text-white",
};

/**
 * The three sounds, made in the browser — no audio files to load or lose.
 * A short high beep is right; a low double buzz is wrong; a rising chime is
 * the whole order picked. Browsers only allow sound after a user gesture,
 * and a scanner's keystrokes count as one, so the first scan unlocks it.
 */
function useSounds() {
  const ctx = useRef<AudioContext | null>(null);

  const tone = useCallback((freq: number, start: number, length: number, type: OscillatorType) => {
    if (!ctx.current) ctx.current = new AudioContext();
    const c = ctx.current;
    if (c.state === "suspended") void c.resume();
    const t = c.currentTime + start;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }, []);

  return {
    good: () => tone(1320, 0, 0.12, "sine"),
    bad: () => {
      tone(190, 0, 0.18, "square");
      tone(150, 0.24, 0.3, "square");
    },
    complete: () => {
      tone(880, 0, 0.12, "sine");
      tone(1175, 0.13, 0.12, "sine");
      tone(1568, 0.26, 0.3, "sine");
    },
  };
}

export function ScanStation() {
  const [view, setView] = useState<PickView | null>(null);
  const [tone, setTone] = useState<Tone>("idle");
  const [message, setMessage] = useState("Scan a pick label to start.");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Scans are handled one at a time, in the order they arrive: a fast
  // scanner can fire the next before the last has been answered.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const viewRef = useRef<PickView | null>(null);
  const sounds = useSounds();

  const show = useCallback(
    (next: Tone, text: string) => {
      setTone(next);
      setMessage(text);
      if (next === "good") sounds.good();
      else if (next === "bad") sounds.bad();
      else if (next === "complete") sounds.complete();
    },
    [sounds]
  );

  const setOrder = (v: PickView | null) => {
    viewRef.current = v;
    setView(v);
  };

  const handleScan = useCallback(
    async (raw: string) => {
      const current = viewRef.current;
      // A pick label: its 2D code ("ORD:…") or its typed reference ("ORD-…").
      const head = raw.trim().toUpperCase();
      if (head.startsWith(ORDER_SCAN_PREFIX) || head.startsWith("ORD:")) {
        const r = await openPickListAction(raw);
        if (!r.ok) return show("bad", r.error);
        setOrder(r.data);
        return show(r.data.complete ? "complete" : "good", r.data.complete ? `${r.data.ref} is already fully picked` : `${r.data.ref} — scan each shelf or item`);
      }
      if (!current) return show("bad", "Scan the pick label first");
      const r = await recordScanAction(current.orderId, raw);
      if (!r.ok) return show("bad", r.error);
      setOrder(r.data.view);
      show(r.data.outcome, r.data.message);
    },
    [show]
  );

  // Keep the scanner's typing landing in the box, whatever was clicked last.
  useEffect(() => {
    const refocus = (e: KeyboardEvent) => {
      if (document.activeElement !== input.current && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", refocus, true);
    return () => window.removeEventListener("keydown", refocus, true);
  }, []);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const raw = input.current?.value ?? "";
    if (input.current) input.current.value = "";
    if (!raw.trim()) return;
    queue.current = queue.current.then(async () => {
      setBusy(true);
      try {
        await handleScan(raw);
      } finally {
        setBusy(false);
      }
    });
  };

  const act = async (fn: () => Promise<{ ok: true; data: PickView } | { ok: false; error: string }>, done: string) => {
    const r = await fn();
    if (!r.ok) show("bad", r.error);
    else {
      setOrder(r.data);
      setTone("idle");
      setMessage(done);
    }
    input.current?.focus();
  };

  const picked = view?.lines.reduce((n, l) => n + Math.min(l.picked, l.quantity), 0) ?? 0;
  const total = view?.lines.reduce((n, l) => n + l.quantity, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl px-6 py-8 text-center transition-colors duration-150 ${PANEL[tone]}`} role="status" aria-live="assertive">
        <p className="text-2xl font-semibold leading-snug sm:text-3xl">{message}</p>
        {view && (
          <p className="mt-2 text-sm opacity-80">
            {view.ref} · {view.customerName}
            {view.postcode ? ` · ${view.postcode}` : ""} · {picked} of {total} picked
          </p>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-3">
        <input
          ref={input}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-label="Scan"
          placeholder={view ? "Scan a shelf or item…" : "Scan the pick label…"}
          className="field flex-1 font-mono text-lg"
        />
        <button type="submit" className="btn-primary" disabled={busy}>
          Enter
        </button>
      </form>

      {view && (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                  <th className="px-5 py-3 font-semibold">Shelf</th>
                  <th className="px-5 py-3 font-semibold">SKU</th>
                  <th className="px-5 py-3 text-right font-semibold">Picked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {view.lines.map((l) => {
                  const done = l.locationCode !== null && l.picked >= l.quantity;
                  return (
                    <tr key={l.id} className={done ? "bg-emerald-50" : l.locationCode === null ? "bg-red-50" : ""}>
                      <td className="px-5 py-3 font-mono font-semibold">{l.locationCode ?? "SHORT"}</td>
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs">{l.skuCode}</span>
                        <span className="block text-xs text-ink-soft">{l.skuName}</span>
                      </td>
                      <td className="px-5 py-3 text-right text-lg font-semibold tabular">
                        {done ? "✓ " : ""}
                        {l.picked} / {l.quantity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {view.complete && view.status === "paid" && (
              <button type="button" className="btn-primary" onClick={() => act(() => markPackedAction(view.orderId), `${view.ref} marked packed. Scan the next pick label.`)}>
                Mark packed
              </button>
            )}
            {view.status === "packed" && <span className="text-sm font-semibold text-brand-deep">Packed</span>}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (window.confirm(`Clear every scan on ${view.ref} and start picking it again?`)) {
                  void act(() => resetPicksAction(view.orderId), `${view.ref} cleared — scan from the start.`);
                }
              }}
            >
              Start this order again
            </button>
            <button type="button" className="text-sm text-ink-soft hover:text-brand-deep" onClick={() => sounds.good()}>
              Test sound
            </button>
          </div>
        </>
      )}
    </div>
  );
}
