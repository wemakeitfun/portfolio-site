"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIG } from "./engine/config.js";

/**
 * The Mojo tins on a floating 3D carousel in a studio. The studio is a band 60% of the
 * screen tall that pins centred on screen while you scroll through it, moving one tin
 * per scroll step; the tin that lands in the centre
 * does a full turn. three.js is loaded only on pages that use this component.
 */
export default function MojoCarousel() {
  const pin = useRef<HTMLElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let carousel: { destroy: () => void } | null = null;
    import("./engine/mountCarousel.js").then(({ mountCarousel }) => {
      if (cancelled) return;
      carousel = mountCarousel(
        { pin: pin.current!, sticky: sticky.current!, stage: stage.current! },
        { onReady: () => setReady(true) },
      );
    });
    return () => {
      cancelled = true;
      carousel?.destroy();
    };
  }, []);

  return (
    <section ref={pin} className="relative" aria-label="Mojo flavours, shown as 3D packs">
      {/* sticky position and height are set by the engine: a centred band, not full screen.
          The studio sits in the same rounded container as the gallery's images and videos. */}
      <div ref={sticky} className="sticky top-[20vh] h-[60vh] px-page-capped">
        <div className="relative h-full overflow-hidden rounded-2xl border border-border bg-[#ebe8e3]">
          {/* the studio fades in once the tins are ready */}
          <div
            ref={stage}
            className={`absolute inset-0 touch-pan-y transition-opacity duration-700 [&>canvas]:block ${
              ready ? "opacity-100" : "opacity-0"
            }`}
          />
        </div>
        <ul className="sr-only">
          {CONFIG.flavours.map((f) => (
            <li key={f.id}>{f.name}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
