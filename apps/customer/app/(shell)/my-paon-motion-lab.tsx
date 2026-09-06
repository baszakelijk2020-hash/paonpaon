"use client";

import { gsap } from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";

type MotionId =
  | "snap"
  | "silk"
  | "aperture"
  | "editorial"
  | "impact"
  | "detail-bounce"
  | "edge"
  | "glide"
  | "spring"
  | "cinema";

interface MotionProfile {
  id: MotionId;
  label: string;
  enter: {
    x: number;
    opacity: number;
    scale: number;
    duration: number;
    ease: string;
  };
  exit: {
    x: number;
    opacity: number;
    scale: number;
    duration: number;
    ease: string;
  };
}

const PROFILES: MotionProfile[] = [
  {
    id: "snap",
    label: "Precision snap",
    enter: {
      x: -76,
      opacity: 0,
      scale: 0.98,
      duration: 0.28,
      ease: "power4.out",
    },
    exit: { x: 76, opacity: 0, scale: 0.98, duration: 0.2, ease: "power4.in" },
  },
  {
    id: "silk",
    label: "Silk glide",
    enter: { x: -124, opacity: 0, scale: 1, duration: 0.62, ease: "expo.out" },
    exit: { x: 112, opacity: 0, scale: 1, duration: 0.38, ease: "expo.in" },
  },
  {
    id: "aperture",
    label: "Aperture bloom",
    enter: {
      x: 0,
      opacity: 0,
      scale: 0.72,
      duration: 0.46,
      ease: "power3.out",
    },
    exit: { x: 0, opacity: 0, scale: 1.16, duration: 0.28, ease: "power3.in" },
  },
  {
    id: "editorial",
    label: "Editorial drift",
    enter: { x: 92, opacity: 0, scale: 0.94, duration: 0.54, ease: "circ.out" },
    exit: { x: -92, opacity: 0, scale: 0.94, duration: 0.3, ease: "circ.in" },
  },
  {
    id: "impact",
    label: "Impact punch",
    enter: {
      x: -22,
      opacity: 0,
      scale: 0.58,
      duration: 0.34,
      ease: "power4.out",
    },
    exit: { x: 22, opacity: 0, scale: 1.12, duration: 0.22, ease: "power4.in" },
  },
  {
    id: "detail-bounce",
    label: "Detail-column bounce",
    enter: {
      x: -58,
      opacity: 0,
      scale: 0.92,
      duration: 0.48,
      ease: "back.out(1.45)",
    },
    exit: {
      x: 46,
      opacity: 0,
      scale: 0.94,
      duration: 0.24,
      ease: "back.in(1.1)",
    },
  },
  {
    id: "edge",
    label: "Edge slice",
    enter: {
      x: -168,
      opacity: 0,
      scale: 1.02,
      duration: 0.42,
      ease: "power2.out",
    },
    exit: {
      x: 168,
      opacity: 0,
      scale: 1.02,
      duration: 0.26,
      ease: "power2.in",
    },
  },
  {
    id: "glide",
    label: "Soft glide",
    enter: { x: 138, opacity: 0, scale: 0.97, duration: 0.7, ease: "sine.out" },
    exit: { x: -138, opacity: 0, scale: 0.97, duration: 0.42, ease: "sine.in" },
  },
  {
    id: "spring",
    label: "Micro spring",
    enter: {
      x: 36,
      opacity: 0,
      scale: 0.84,
      duration: 0.52,
      ease: "elastic.out(1, 0.62)",
    },
    exit: {
      x: -36,
      opacity: 0,
      scale: 0.88,
      duration: 0.25,
      ease: "power2.in",
    },
  },
  {
    id: "cinema",
    label: "Cinema resolve",
    enter: {
      x: -104,
      opacity: 0,
      scale: 1.08,
      duration: 0.58,
      ease: "quart.out",
    },
    exit: { x: 104, opacity: 0, scale: 1.08, duration: 0.34, ease: "quart.in" },
  },
];

const RESTING_STATE = { x: 0, opacity: 1, scale: 1 };
const HIDDEN_STATE = { opacity: 0, scale: 0.96 };

/** Temporary isolated animation picker for selecting a My PAON arrival. */
export function MyPaonMotionLab() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<MotionId | null>(null);

  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hidePreview = useCallback((profile: MotionProfile) => {
    const preview = previewRef.current;
    if (!preview) return;

    gsap.killTweensOf(preview);
    if (reducedMotion()) {
      gsap.set(preview, { ...HIDDEN_STATE, x: 0 });
      return;
    }
    preview.style.willChange = "transform, opacity";
    gsap.to(preview, {
      ...profile.exit,
      overwrite: "auto",
      onComplete: () => {
        preview.style.willChange = "";
      },
    });
  }, []);

  const showPreview = useCallback((profile: MotionProfile) => {
    const preview = previewRef.current;
    if (!preview) return;

    gsap.killTweensOf(preview);
    if (reducedMotion()) {
      gsap.set(preview, RESTING_STATE);
      return;
    }
    preview.style.willChange = "transform, opacity";
    gsap.fromTo(
      preview,
      {
        x: profile.enter.x,
        opacity: profile.enter.opacity,
        scale: profile.enter.scale,
      },
      {
        ...RESTING_STATE,
        duration: profile.enter.duration,
        ease: profile.enter.ease,
        overwrite: "auto",
        onComplete: () => {
          preview.style.willChange = "";
        },
      },
    );
  }, []);

  const chooseProfile = (profile: MotionProfile) => {
    if (activeId === profile.id) {
      setActiveId(null);
      hidePreview(profile);
      return;
    }
    setActiveId(profile.id);
    showPreview(profile);
  };

  useEffect(() => {
    const preview = previewRef.current;
    return () => {
      if (preview) gsap.killTweensOf(preview);
    };
  }, []);

  return (
    <aside
      aria-label="My PAON motion lab"
      style={{
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: 120,
        width: "300px",
        padding: "12px",
        border: "1px solid rgba(255,255,255,.2)",
        borderRadius: "14px",
        background: "rgba(22,22,22,.94)",
        boxShadow: "0 18px 48px rgba(0,0,0,.32)",
        color: "#f5f4ef",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
        }}
      >
        My PAON motion lab
      </div>
      <div
        aria-live="polite"
        style={{
          display: "grid",
          placeItems: "center",
          height: "92px",
          margin: "10px 0",
          overflow: "hidden",
          borderRadius: "9px",
          background: "#eceae2",
        }}
      >
        <div
          ref={previewRef}
          style={{
            ...HIDDEN_STATE,
            width: "190px",
            padding: "14px",
            borderRadius: "7px",
            background: "#151515",
            color: "#f5f4ef",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: ".03em",
            textAlign: "center",
          }}
        >
          {activeId
            ? PROFILES.find((profile) => profile.id === activeId)?.label
            : "Preview"}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {PROFILES.map((profile) => {
          const active = activeId === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              aria-pressed={active}
              onClick={() => chooseProfile(profile)}
              style={{
                flex: "1 1 136px",
                minHeight: "30px",
                padding: "6px 8px",
                border: active
                  ? "1px solid #f5f4ef"
                  : "1px solid rgba(255,255,255,.18)",
                borderRadius: "6px",
                background: active ? "#f5f4ef" : "rgba(255,255,255,.06)",
                color: active ? "#151515" : "#e8e6df",
                cursor: "pointer",
                font: "inherit",
                fontSize: "10px",
                textAlign: "left",
              }}
            >
              {profile.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
