import { useEffect, useRef, type RefObject } from "react";
import {
  GradientBlurOverlay,
  GradientBlurProvider,
  type GradientBlurActiveBackend,
  type GradientBlurBackend,
  type GradientBlurMetrics,
  type GradientBlurProviderHandle,
} from "@/components/gradient-blur";
import { cardClipPath, type CardRegion } from "./card-regions";
import { useCardRegions } from "./useCardRegions";
import styles from "./surface.module.css";

interface GlassBackdropProps {
  root: RefObject<HTMLElement | null>;
  src: string;
  radius: number;
  backend: GradientBlurBackend;
  pixelRatio: number;
  onBackend(backend: GradientBlurActiveBackend): void;
  onMetrics(metrics: GradientBlurMetrics): void;
  onRegions(regions: readonly CardRegion[]): void;
}

export function GlassBackdrop({
  root,
  src,
  radius,
  backend,
  pixelRatio,
  onBackend,
  onMetrics,
  onRegions,
}: GlassBackdropProps) {
  const regions = useCardRegions(root);
  const provider = useRef<GradientBlurProviderHandle>(null);
  useEffect(() => onRegions(regions), [regions, onRegions]);
  return (
    <div
      className={styles.layer}
      style={{ clipPath: cardClipPath(regions) }}
      aria-hidden="true"
    >
      <GradientBlurProvider
        ref={provider}
        sourceMode="static"
        className={styles.provider}
        captureBackend={backend}
        maxDevicePixelRatio={pixelRatio}
        onBackendChange={onBackend}
      >
        <div className={styles.source} data-gradient-blur-source="">
          {/* A native img is intentional: both capture backends sample this exact resource. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className={styles.image}
            onLoad={() => provider.current?.refresh()}
          />
        </div>
        {regions.map((region) => (
          <GradientBlurOverlay
            key={region.id}
            data-card-overlay={region.id}
            maxRadius={radius}
            height={region.height}
            style={{
              top: region.y,
              left: region.x,
              width: region.width,
              insetInline: "auto",
            }}
            onMetrics={onMetrics}
          />
        ))}
      </GradientBlurProvider>
    </div>
  );
}
