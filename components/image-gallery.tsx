"use client";

import { useState } from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

// Main product image with clickable thumbnails. Remote catalog images, not optimized.
export function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
        No image
      </div>
    );
  }
  const shown = images[Math.min(current, images.length - 1)];
  return (
    <div className="space-y-2">
      <a href={shown} target="_blank" rel="noreferrer" className="block" title="Open the image in a new tab">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote catalog images, not optimized */}
        <img src={shown} alt={alt} className="aspect-[4/3] w-full rounded-lg border border-slate-200 bg-white object-contain" loading="lazy" />
      </a>
      {images.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {images.slice(0, 6).map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Show image ${i + 1}`}
              aria-pressed={i === current}
              className={cx(
                "size-12 overflow-hidden rounded-md border bg-white transition",
                i === current ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-400",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote catalog images, not optimized */}
              <img src={src} alt="" className="size-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
