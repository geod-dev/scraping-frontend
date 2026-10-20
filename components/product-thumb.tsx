const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

const SIZES = {
  sm: "size-10 rounded-md",
  md: "size-14 rounded-lg",
  lg: "size-20 rounded-lg",
  fill: "aspect-square w-full rounded-lg",
};

// Product image on a white tile, or a neutral placeholder when the product has none.
// Remote catalog images, not optimized.
export function ProductThumb({ src, alt = "", size = "sm", className }: { src: string | null | undefined; alt?: string; size?: keyof typeof SIZES; className?: string }) {
  const box = cx("shrink-0 overflow-hidden border border-slate-200 bg-white", SIZES[size], className);
  if (!src) {
    return (
      <span className={cx(box, "flex items-center justify-center bg-slate-50 text-slate-300")} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-1/2 max-h-8 max-w-8">
          <path d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2l1.5-1.5a2 2 0 012.8 0L20 14M4 6h16v12H4z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className={box}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote catalog images, not optimized */}
      <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-contain p-0.5" />
    </span>
  );
}
