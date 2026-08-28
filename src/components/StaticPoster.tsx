import { useCallback, useEffect, useRef } from "react";

import poster1280 from "@/assets/dore-pentecost-dark-1280.webp";
import poster2048 from "@/assets/dore-pentecost-dark-2048.webp";
import { cn } from "@/lib/utils";

export type StaticPosterProps = {
  /** the poster is on screen (or has failed — either way the page may open); fires once */
  onReady?: () => void;
  className?: string;
};

/**
 * The still that stands in for the WebGL scene (see scene/fallback.ts): the
 * darkened Doré plate covering the scene container. The intro and the
 * reduced-motion fade wait on the same ready signal the parallax gives.
 */
export default function StaticPoster({ onReady, className }: StaticPosterProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  // fires once: load, error and the cached-image check may all arrive
  const fired = useRef(false);
  const reportReady = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    onReadyRef.current?.();
  }, []);

  // a cached image may have completed before the load handler was attached
  useEffect(() => {
    if (imgRef.current?.complete) reportReady();
  }, [reportReady]);

  return (
    <picture data-poster="" className={cn("absolute inset-0 block", className)}>
      <source type="image/webp" srcSet={`${poster1280} 1280w, ${poster2048} 2048w`} sizes="100vw" />
      <img
        ref={imgRef}
        src={poster1280}
        alt=""
        decoding="async"
        fetchPriority="high"
        onLoad={reportReady}
        onError={reportReady}
        className="block h-full w-full object-cover object-[50%_42%]"
      />
    </picture>
  );
}
