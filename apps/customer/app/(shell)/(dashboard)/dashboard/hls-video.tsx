"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

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
/** How long to wait before building a fresh player over a dead one. */
const RETRY_MS = 4_000;
/**
 * How far behind the live edge the player may sit before a press of play
 * jumps it forward. Under this it simply resumes: a seek costs a decoder
 * flush, which shows as a twitch.
 */
const LIVE_EDGE_SLACK_S = 6;

export function HlsVideo({
  src,
  className,
  style,
  title,
  paused = false,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** Held still by the viewer's pause; the nudge below leaves it alone. */
  paused?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  /* Bumped to build a fresh player after one gives up. It is in the effect's
     deps, so a bump tears the dead one down and starts over. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let destroy: (() => void) | undefined;
    let retry = 0;

    const play = () => {
      if (pausedRef.current) return;
      void video.play().catch(() => undefined);
    };

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", play);
      /* Safari plays this itself, so there is no hls.js to recover it: a
         dropped camera raises `error` on the element and stays black. Ask for
         the stream again. */
      const onError = () => {
        retry = window.setTimeout(() => {
          if (!disposed) setAttempt((n) => n + 1);
        }, RETRY_MS);
      };
      video.addEventListener("error", onError);
      destroy = () => {
        video.removeEventListener("loadedmetadata", play);
        video.removeEventListener("error", onError);
      };
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
          else {
            /* Anything hls.js cannot recover in place. Destroying alone left
               the <video> black for good — nothing ever rebuilt the player,
               so the camera never came back without a page reload. Build a
               new one instead; these public cameras drop often. */
            hls.destroy();
            retry = window.setTimeout(() => {
              if (!disposed) setAttempt((n) => n + 1);
            }, RETRY_MS);
          }
        });
        destroy = () => hls.destroy();
      });
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") play();
    };
    document.addEventListener("visibilitychange", onVisible);
    const nudge = window.setInterval(() => {
      if (
        video.paused &&
        !pausedRef.current &&
        document.visibilityState === "visible"
      )
        play();
    }, 3_000);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(nudge);
      window.clearTimeout(retry);
      destroy?.();
    };
  }, [src, attempt]);

  /* Pause holds the frame. Play does not pick up where it left off — it is a
     live camera, so it catches up to the live edge and plays from now.
     "Catches up" is conditional: seeking to the very end of the seekable
     range on a stream that is already there makes the decoder flush and the
     picture twitch, so the jump only happens when the player has actually
     fallen behind. Landing a little short of the edge also leaves the buffer
     something to play out of. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) {
      video.pause();
      return;
    }
    const seekable = video.seekable;
    if (seekable.length > 0) {
      try {
        const edge = seekable.end(seekable.length - 1);
        if (edge - video.currentTime > LIVE_EDGE_SLACK_S) {
          video.currentTime = Math.max(0, edge - 1);
        }
      } catch {
        // Not seekable yet; play from wherever the stream is.
      }
    }
    void video.play().catch(() => undefined);
  }, [paused]);

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
