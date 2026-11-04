import { brand } from "./site";

/** A placeholder home page until the brand's design lands. */
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-5xl text-ink">{brand.name}</h1>
      <p className="mt-4 text-lg text-ink-soft">Coming soon</p>
    </main>
  );
}
