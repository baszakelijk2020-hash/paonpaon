"use client";

import { type CSSProperties, useEffect, useRef } from "react";

/**
 * An HLS camera, for the feeds that are a raw .m3u8 rather than a YouTube
 * embed. Safari plays HLS natively; everything else needs hls.js, which is
 * imported on demand so it only ships to viewers who actually reach a feed
 * that needs it.
 *
 * The retry behaviour matches the founder's own player: network errors resume
 * the load, media errors recover in place, and a paused video on a visible tab
 * is nudged back into play — these public cameras drop often.
 */
export function HlsVideo({
  src,
  className,
  style,
  title,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let destroy: (() => void) | undefined;

    const play = () => void video.play().catch(() => undefined);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", play);
      destroy = () => video.removeEventListener("loadedmetadata", play);
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (disposed || !Hls.isSupported()) return;
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          manifestLoadingMaxRetry: Infinity,
          levelLoadingMaxRetry: Infinity,
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, play);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR)
            hls.recoverMediaError();
          else hls.destroy();
        });
        destroy = () => hls.destroy();
      });
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") play();
    };
    document.addEventListener("visibilitychange", onVisible);
    const nudge = window.setInterval(() => {
      if (video.paused && document.visibilityState === "visible") play();
    }, 3_000);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(nudge);
      destroy?.();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      title={title}
      autoPlay
      muted
      playsInline
    />
  );
}
