export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-ink-soft">
        Pick at Store presents
      </p>
      <h1 className="mt-4 max-w-2xl text-4xl leading-tight sm:text-6xl">
        Local Stores &amp; Their Stories
      </h1>
      <p className="mt-6 max-w-xl text-xl italic text-ink-soft sm:text-2xl">
        Some places never leave us.
      </p>
      <div className="mt-10 h-px w-24 bg-marigold" aria-hidden="true" />
      <p className="mt-10 max-w-md text-base text-ink-soft">
        The chai stall outside school, the bakery that smelled of Sunday, the
        kirana that kept your family&apos;s tab. Soon you can pin yours to the
        map of India and pass the memory on.
      </p>
      <p className="mt-12 text-sm text-ink-soft">Coming soon</p>
    </main>
  );
}
