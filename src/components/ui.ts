// Buttons, boxes and cards painted like a shop sign: a dark outline and a
// hard shadow that a button loses when it's pressed.

export const primaryButton =
  "inline-flex items-center justify-center rounded-full border-2 border-ink bg-brand-red px-5 py-2.5 font-extrabold text-cream pop transition hover:bg-brand-red-deep active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-3";

export const secondaryButton =
  "inline-flex items-center justify-center rounded-full border-2 border-ink bg-cream px-5 py-2 font-extrabold text-ink pop transition hover:bg-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-2.5";

export const input =
  "w-full rounded-xl border-2 border-ink bg-[#fffaf0] px-3.5 py-2.5 text-base sm:px-4 sm:py-3 text-ink outline-none placeholder:text-ink-soft/80 focus:ring-4 focus:ring-brand-yellow/60";

export const card =
  "w-full rounded-2xl border-2 border-ink bg-[#fff8ea] p-4 pop-lg sm:rounded-3xl sm:p-8";

/** A page's title, in shop-sign letters. */
export const pageTitle =
  "font-display text-2xl leading-tight text-brand-red sm:text-3xl";
