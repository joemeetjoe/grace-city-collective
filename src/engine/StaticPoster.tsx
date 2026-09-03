import { useCallback, useEffect, useRef, useState } from "react";

import avif640 from "@/assets/poster/dore-pentecost-dark-640.avif";
import avif960 from "@/assets/poster/dore-pentecost-dark-960.avif";
import avif1280 from "@/assets/poster/dore-pentecost-dark-1280.avif";
import avif1600 from "@/assets/poster/dore-pentecost-dark-1600.avif";
import avif2048 from "@/assets/poster/dore-pentecost-dark-2048.avif";
import webp640 from "@/assets/poster/dore-pentecost-dark-640.webp";
import webp960 from "@/assets/poster/dore-pentecost-dark-960.webp";
import webp1280 from "@/assets/poster/dore-pentecost-dark-1280.webp";
import webp1600 from "@/assets/poster/dore-pentecost-dark-1600.webp";
import webp2048 from "@/assets/poster/dore-pentecost-dark-2048.webp";
import { readSaveData } from "@/device/tier";
import { cn } from "@/lib/utils";

import { POSTER_RUNGS, type PosterFormat } from "./posterLadder";

/**
 * The ladder's files by format and rung, in POSTER_RUNGS order
 * (tools/poster/ladder.py writes them; Vite fingerprints them).
 */
const LADDER: Record<PosterFormat, readonly string[]> = {
  avif: [avif640, avif960, avif1280, avif1600, avif2048],
  webp: [webp640, webp960, webp1280, webp1600, webp2048],
};

/** the ladder as a srcset: every rung ascending with its `w` descriptor */
const srcSetOf = (format: PosterFormat) => LADDER[format].map((url, i) => `${url} ${POSTER_RUNGS[i]}w`).join(", ");

export type StaticPosterProps = {
  /** the poster is on screen (or has failed — either way the page may open); fires once */
  onReady?: () => void;
  className?: string;
  /** the Save-Data hint; read from `navigator.connection` at mount when not given */
  saveData?: boolean;
};

/**
 * The still that stands in for the WebGL scene (see scene/fallback.ts): the
 * darkened Doré plate covering the scene container, offered as a width
 * ladder in AVIF then WebP (posterLadder.ts) that the browser picks from by
 * viewport width and DPR. Under Save-Data only the smallest rung is offered,
 * whatever the display. The intro and the reduced-motion fade wait on the
 * same ready signal the parallax gives.
 */
export default function StaticPoster({ onReady, className, saveData }: StaticPosterProps) {
  const [reduceData] = useState(() => saveData ?? readSaveData());
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
      {reduceData ? (
        // a fixed candidate, no descriptors: nothing for the browser to upgrade to
        <source type="image/avif" srcSet={LADDER.avif[0]} />
      ) : (
        <>
          <source type="image/avif" srcSet={srcSetOf("avif")} sizes="100vw" />
          <source type="image/webp" srcSet={srcSetOf("webp")} sizes="100vw" />
        </>
      )}
      <img
        ref={imgRef}
        src={LADDER.webp[0]}
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
