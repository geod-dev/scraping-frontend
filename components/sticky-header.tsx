"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Page header that sticks to the top of the viewport and condenses once the page scrolls:
// children style themselves with `group-data-[condensed=true]/header:` variants. A spacer
// makes up for the height the header loses, so the content below never jumps.
export function StickyHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const expanded = useRef(0);
  const [condensed, setCondensed] = useState(false);
  const [spacer, setSpacer] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      const height = el.offsetHeight;
      if (el.dataset.condensed === "true") {
        setSpacer(Math.max(0, expanded.current - height));
      } else {
        expanded.current = height;
        setSpacer(0);
      }
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setCondensed(window.scrollY > 16);
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <header
        ref={ref}
        data-condensed={condensed}
        className={[
          "group/header sticky top-0 z-20 mb-6 transition-[padding] duration-200 data-[condensed=true]:py-2.5",
          // Full-bleed background behind the header (the main column clips the overflow).
          "before:absolute before:inset-y-0 before:-inset-x-[100vmax] before:-z-10 before:bg-background/90 before:backdrop-blur-md before:transition",
          "data-[condensed=true]:before:border-b data-[condensed=true]:before:shadow-[0_6px_16px_-12px_rgb(15_23_42/0.25)]",
        ].join(" ")}
      >
        {children}
      </header>
      {spacer > 0 ? <div aria-hidden style={{ height: spacer }} /> : null}
    </>
  );
}
