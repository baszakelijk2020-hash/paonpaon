"use client";

import {
  SUIT_CONFIGURATION_MODEL_PRESETS,
  type SuitConfigurationLapel,
  type SuitConfigurationModelPreset,
  type SuitConfigurationPockets,
  type SuitConfigurationShoulder,
} from "@paon/domain";
import { useEffect, useRef } from "react";

/**
 * Exact port of pag1.html's `#suit-configurator-widget` — three
 * scroll-snapped, click-and-swipe carousels (lapel/pockets/shoulder)
 * synchronized to a top model carousel with three predefined coherent
 * combinations. CSS, markup, class names and image URLs are byte-for-byte
 * from the source; `CSS_SETTINGS` below inlines the source's
 * `applyCssSettings()` runtime constants as static values (they were never
 * exposed as end-user controls in the source either). The source drives
 * scroll-to-panel and opacity crossfade with GSAP + ScrollToPlugin; this
 * port has no GSAP dependency in this codebase, so scroll easing is a
 * hand-rolled requestAnimationFrame tween using GSAP's own power2.inOut
 * formula (matches am-house-orbit.tsx's precedent of reimplementing source
 * animation math directly rather than adding a library), and the opacity
 * crossfade is a plain CSS transition — visually equivalent, no callback
 * timing to replicate.
 */

const CSS_SETTINGS = {
  ddPanelWidth: 100,
  ddPanelHeight: 86,
  ddImageWidth: 138,
  ddImageHeight: 76,
  ddX: 0,
  ddY: -5,
  dbScale: 1,
  dbX: 0,
  dbY: 0,
  shoulderYOffset: 4,
};

const WIDGET_CSS = `
#suit-configurator-widget {
  width: 390px;
  overflow: hidden;
  color: #1A1A1A;
  font-family: 'Optimaklein', sans-serif;
  position: relative;
  background: transparent;
  margin: 0 auto;
  --db-scale: ${CSS_SETTINGS.dbScale};
  --db-x: ${CSS_SETTINGS.dbX}px;
  --db-y: ${CSS_SETTINGS.dbY}px;
  --dd-panel-width: ${CSS_SETTINGS.ddPanelWidth}px;
  --dd-panel-height: ${CSS_SETTINGS.ddPanelHeight}px;
  --dd-image-width: ${CSS_SETTINGS.ddImageWidth}px;
  --dd-image-height: ${CSS_SETTINGS.ddImageHeight}px;
  --dd-x: ${CSS_SETTINGS.ddX}px;
  --dd-y: ${CSS_SETTINGS.ddY}px;
  --shoulder-y-offset: ${CSS_SETTINGS.shoulderYOffset}px;
}
#suit-configurator-widget .model-carousel-container,
#suit-configurator-widget .carousel-container {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
  overflow-x: auto !important;
  overflow-y: hidden !important;
}
#suit-configurator-widget ::-webkit-scrollbar { display: none !important; }
#suit-configurator-widget * { box-sizing: border-box; }
#suit-configurator-widget .model-selector-container {
  width: 390px;
  position: relative;
  margin-bottom: 20px;
  overflow: hidden !important;
}
#suit-configurator-widget .model-carousel-clip {
  overflow: hidden !important;
  width: 100%;
  position: relative;
}
#suit-configurator-widget .model-carousel-fade {
  position: absolute;
  top: 0;
  width: 115px;
  height: 232px;
  pointer-events: none;
  z-index: 10;
}
#suit-configurator-widget .model-carousel-fade.left {
  left: 0;
  background: linear-gradient(to right, rgba(245,242,237,1) 0%, rgba(245,242,237,0) 100%);
}
#suit-configurator-widget .model-carousel-fade.right {
  right: 0;
  background: linear-gradient(to right, rgba(245,242,237,0) 0%, rgba(245,242,237,1) 100%);
}
#suit-configurator-widget .model-carousel-container {
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  display: flex;
  padding-bottom: 100px !important;
  margin-bottom: -100px !important;
  width: 100%;
}
#suit-configurator-widget .model-track { display: flex; gap: 25px; }
#suit-configurator-widget .model-track::before,
#suit-configurator-widget .model-track::after {
  content: '';
  display: block;
  flex-shrink: 0;
  width: calc(50% - 80.5px);
}
#suit-configurator-widget .model-panel {
  flex: 0 0 161px;
  height: 232px;
  scroll-snap-align: center;
  cursor: pointer;
  will-change: transform;
}
#suit-configurator-widget .model-panel-visual { width: 161px; height: 232px; overflow: hidden; }
#suit-configurator-widget .model-panel-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
#suit-configurator-widget .carousel-panel {
  flex: 0 0 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  scroll-snap-align: center;
  opacity: 0.35;
  position: relative;
  will-change: opacity;
  transition: opacity 0.18s ease-out;
  cursor: pointer;
}
#suit-configurator-widget .panel-image-container {
  border-radius: 10px;
  overflow: hidden;
  width: 100%;
  background-color: #000000;
  position: relative;
}
#suit-configurator-widget #pockets-carousel .carousel-panel .panel-image-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 9px;
  background-color: #000000;
  z-index: 3;
}
#suit-configurator-widget #lapel-carousel .carousel-panel[data-panel-index="3"] {
  flex: 0 0 var(--dd-panel-width) !important;
}
#suit-configurator-widget #lapel-carousel .carousel-panel[data-panel-index="3"] .panel-image-container {
  width: var(--dd-panel-width) !important;
  height: var(--dd-panel-height) !important;
}
#suit-configurator-widget #dd-image-target {
  width: var(--dd-image-width) !important;
  height: var(--dd-image-height) !important;
  object-fit: contain !important;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translate(var(--dd-x), var(--dd-y)) scale(var(--db-scale)) !important;
  transform-origin: center center;
  z-index: 2;
}
#suit-configurator-widget #shoulder-carousel .panel-image {
  transform: translateY(var(--shoulder-y-offset)) !important;
}
#suit-configurator-widget .panel-image { width: 100%; height: auto; display: block; }
#suit-configurator-widget .panel-image:not([src*="77dbb.png"]):not([src*="33db.png"]):not([src*="dbdbdb.png"]):not([src*="dbdbd1b.png"]) {
  filter: invert(1);
}
#suit-configurator-widget .panel-label { margin-top: 5px; font-size: 10px; }
#suit-configurator-widget .carousel-stack { display: flex; flex-direction: column; gap: 20px; }
#suit-configurator-widget .carousel-row { position: relative; }
#suit-configurator-widget .carousel-row-title {
  text-align: center;
  margin: 20px 0 5px;
  font-family: 'GTBold3', sans-serif;
  font-size: 7px;
  text-transform: uppercase;
}
#suit-configurator-widget .carousel-clip { overflow: hidden !important; width: 100%; }
#suit-configurator-widget .carousel-container {
  scroll-snap-type: x mandatory;
  padding-bottom: 100px !important;
  margin-bottom: -100px !important;
}
#suit-configurator-widget .carousel-track { display: flex; gap: 10px; }
#suit-configurator-widget .carousel-track::before,
#suit-configurator-widget .carousel-track::after {
  content: '';
  display: block;
  flex-shrink: 0;
  width: calc(50% - 50px);
}
#suit-configurator-widget .selection-indicator {
  position: absolute;
  top: 100%;
  margin-top: 8px;
  left: 0;
  right: 0;
  height: 1px;
  background-color: #E0E0E0;
  pointer-events: none;
}
#suit-configurator-widget .selection-indicator::after {
  content: '';
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid #E0E0E0;
}
@font-face {
  font-family: 'Optimaklein';
  src: url('/fonts/googleflex.woff2') format('woff2');
  font-display: swap;
}
@font-face {
  font-family: 'GTBold3';
  src: url('/fonts/gtbold3.woff2') format('woff2');
  font-display: swap;
}
`;

const MODEL_PANELS: {
  model: SuitConfigurationModelPreset;
  img: string;
  alt: string;
}[] = [
  {
    model: 1,
    img: "https://www.nebelspiegel.com/images/00notch.png",
    alt: "Henk",
  },
  {
    model: 2,
    img: "https://www.nebelspiegel.com/images/00peak.png",
    alt: "Willem",
  },
  {
    model: 3,
    img: "https://www.nebelspiegel.com/images/00db.png",
    alt: "Karel",
  },
];

const LAPEL_PANELS: {
  value: SuitConfigurationLapel;
  label: string;
  img: string;
  isDdTarget?: boolean;
}[] = [
  {
    value: "notch",
    label: "Notch",
    img: "https://www.nebelspiegel.com/images/lapel1.png",
  },
  {
    value: "peak",
    label: "Peak",
    img: "https://www.nebelspiegel.com/images/lapel2.png",
  },
  {
    value: "shawl",
    label: "Shawl",
    img: "https://www.nebelspiegel.com/images/lapel3.png",
  },
  {
    value: "double_breasted",
    label: "Double-Breasted",
    img: "https://www.nebelspiegel.com/images/dbdbd2b.png",
    isDdTarget: true,
  },
];

const POCKETS_PANELS: {
  value: SuitConfigurationPockets;
  label: string;
  img: string;
}[] = [
  {
    value: "flap",
    label: "Flap",
    img: "https://www.nebelspiegel.com/images/pocket1.png",
  },
  {
    value: "jetted",
    label: "Jetted",
    img: "https://www.nebelspiegel.com/images/pocket2.png",
  },
  {
    value: "patched",
    label: "Patched",
    img: "https://www.nebelspiegel.com/images/pocket3.png",
  },
];

const SHOULDER_PANELS: {
  value: SuitConfigurationShoulder;
  label: string;
  img: string;
}[] = [
  {
    value: "classic",
    label: "Classic",
    img: "https://www.nebelspiegel.com/images/shoulder1.png",
  },
  {
    value: "natural",
    label: "Natural",
    img: "https://www.nebelspiegel.com/images/shoulder2.png",
  },
  {
    value: "roped",
    label: "Roped",
    img: "https://www.nebelspiegel.com/images/shoulder3.png",
  },
  {
    value: "spalla_camicia",
    label: "Spalla Camicia",
    img: "https://www.nebelspiegel.com/images/shoulder4.png",
  },
];

export interface SuitConfigurationSelection {
  lapel: SuitConfigurationLapel;
  pockets: SuitConfigurationPockets;
  shoulder: SuitConfigurationShoulder;
  modelPreset?: SuitConfigurationModelPreset;
}

function easePower2InOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function selectionFromIndices(
  lapelIndex: number,
  pocketsIndex: number,
  shoulderIndex: number,
): SuitConfigurationSelection {
  const lapel = LAPEL_PANELS[lapelIndex]?.value ?? "notch";
  const pockets = POCKETS_PANELS[pocketsIndex]?.value ?? "flap";
  const shoulder = SHOULDER_PANELS[shoulderIndex]?.value ?? "classic";
  const modelPreset = (
    Object.keys(
      SUIT_CONFIGURATION_MODEL_PRESETS,
    ) as unknown as SuitConfigurationModelPreset[]
  ).find((preset) => {
    const config = SUIT_CONFIGURATION_MODEL_PRESETS[preset];
    return (
      config.lapel === lapel &&
      config.pockets === pockets &&
      config.shoulder === shoulder
    );
  });
  return { lapel, pockets, shoulder, ...(modelPreset ? { modelPreset } : {}) };
}

export function SuitConfiguratorWidget({
  onSelectionChange,
}: {
  onSelectionChange: (selection: SuitConfigurationSelection) => void;
}) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget) return;

    const modelCarousel = widget.querySelector<HTMLDivElement>(
      "#main-model-carousel",
    );
    if (!modelCarousel) return;
    const modelPanels = Array.from(
      widget.querySelectorAll<HTMLDivElement>(".model-panel"),
    );
    const optionCarousels = Array.from(
      widget.querySelectorAll<HTMLDivElement>(
        ".carousel-container:not(#main-model-carousel)",
      ),
    );

    const modelConfigs: Record<
      number,
      { lapel: number; pockets: number; shoulder: number }
    > = {
      1: { lapel: 0, pockets: 1, shoulder: 1 },
      2: { lapel: 1, pockets: 0, shoulder: 2 },
      3: { lapel: 3, pockets: 2, shoulder: 3 },
    };

    let lastModel: string | null = null;
    let isInternalScrolling = false;
    const cancelers = new Set<() => void>();

    function currentSelection() {
      const lapelEl = widget?.querySelector("#lapel-carousel");
      const pocketsEl = widget?.querySelector("#pockets-carousel");
      const shoulderEl = widget?.querySelector("#shoulder-carousel");
      const lapelIndex = lapelEl
        ? Number(
            getClosestPanel(lapelEl as HTMLElement)?.dataset["panelIndex"] ?? 0,
          )
        : 0;
      const pocketsIndex = pocketsEl
        ? Number(
            getClosestPanel(pocketsEl as HTMLElement)?.dataset["panelIndex"] ??
              0,
          )
        : 0;
      const shoulderIndex = shoulderEl
        ? Number(
            getClosestPanel(shoulderEl as HTMLElement)?.dataset["panelIndex"] ??
              0,
          )
        : 0;
      onSelectionChangeRef.current(
        selectionFromIndices(lapelIndex, pocketsIndex, shoulderIndex),
      );
    }

    function getClosestPanel(carousel: HTMLElement): HTMLElement | null {
      const center = carousel.scrollLeft + carousel.offsetWidth / 2;
      let closest: HTMLElement | null = null;
      let minDiff = Infinity;
      const panels = carousel.querySelectorAll<HTMLElement>(
        ".carousel-panel, .model-panel",
      );
      panels.forEach((p) => {
        const pCenter = p.offsetLeft + p.offsetWidth / 2;
        const diff = Math.abs(center - pCenter);

        if (carousel.id === "main-model-carousel") {
          const dist = Math.min(diff / (carousel.offsetWidth / 2), 1);
          const scale = 1 - dist * 0.05;
          p.style.transform = `scale(${scale})`;
        }

        if (diff < minDiff) {
          minDiff = diff;
          closest = p;
        }
      });
      return closest;
    }

    function updateOptionStates(carousel: HTMLElement) {
      const closest = getClosestPanel(carousel);
      const panels = carousel.querySelectorAll<HTMLElement>(".carousel-panel");
      panels.forEach((p) => {
        p.style.opacity = p === closest ? "1" : "0.35";
      });
    }

    function goToPanel(
      carousel: HTMLElement | null,
      targetPanel: HTMLElement | null,
      immediate: boolean,
    ) {
      if (!carousel || !targetPanel) return;
      const targetX =
        targetPanel.offsetLeft -
        (carousel.offsetWidth - targetPanel.offsetWidth) / 2;

      if (immediate) {
        carousel.scrollLeft = targetX;
        getClosestPanel(carousel);
        if (carousel.id !== "main-model-carousel") updateOptionStates(carousel);
        return;
      }

      isInternalScrolling = true;
      carousel.style.scrollSnapType = "none";
      const start = carousel.scrollLeft;
      const delta = targetX - start;
      const duration = 0.8;
      const startTime = performance.now();

      function frame(now: number) {
        const t = Math.min((now - startTime) / 1000 / duration, 1);
        carousel!.scrollLeft = start + delta * easePower2InOut(t);
        getClosestPanel(carousel!);
        if (carousel!.id === "main-model-carousel") {
          const currentClosest = getClosestPanel(carousel!);
          const model = currentClosest?.dataset["model"];
          if (currentClosest && model !== lastModel) {
            lastModel = model ?? null;
            if (lastModel) syncSubCarouselsToModel(lastModel, false);
          }
        } else {
          updateOptionStates(carousel!);
        }
        if (t < 1) {
          raf = requestAnimationFrame(frame);
        } else {
          carousel!.style.scrollSnapType = "x mandatory";
          isInternalScrolling = false;
          getClosestPanel(carousel!);
          if (carousel!.id !== "main-model-carousel") {
            updateOptionStates(carousel!);
          }
          currentSelection();
        }
      }
      let raf = requestAnimationFrame(frame);
      cancelers.add(() => cancelAnimationFrame(raf));
    }

    function syncSubCarouselsToModel(modelId: string, immediate: boolean) {
      const config = modelConfigs[Number(modelId)];
      if (!config) return;
      (Object.keys(config) as (keyof typeof config)[]).forEach((key) => {
        const carousel = widget?.querySelector<HTMLElement>(`#${key}-carousel`);
        const target = carousel?.querySelector<HTMLElement>(
          `[data-panel-index="${config[key]}"]`,
        );
        goToPanel(carousel ?? null, target ?? null, immediate);
      });
      if (immediate) currentSelection();
    }

    function onModelScroll() {
      getClosestPanel(modelCarousel!);
      if (isInternalScrolling) return;
      const closest = getClosestPanel(modelCarousel!);
      const model = closest?.dataset["model"];
      if (closest && model !== lastModel) {
        lastModel = model ?? null;
        if (lastModel) syncSubCarouselsToModel(lastModel, false);
      }
    }
    modelCarousel.addEventListener("scroll", onModelScroll);

    const optionScrollHandlers = optionCarousels.map((carousel) => {
      const handler = () => {
        if (isInternalScrolling) return;
        updateOptionStates(carousel);
        currentSelection();
      };
      carousel.addEventListener("scroll", handler);
      return { carousel, handler };
    });

    const panelClickHandlers: { el: Element; handler: () => void }[] = [];
    optionCarousels.forEach((carousel) => {
      const panels = carousel.querySelectorAll<HTMLElement>(".carousel-panel");
      panels.forEach((panel) => {
        const handler = () => goToPanel(carousel, panel, false);
        panel.addEventListener("click", handler);
        panelClickHandlers.push({ el: panel, handler });
      });
    });
    modelPanels.forEach((panel) => {
      const handler = () => goToPanel(modelCarousel, panel, false);
      panel.addEventListener("click", handler);
      panelClickHandlers.push({ el: panel, handler });
    });

    const initialPanel = modelPanels[0];
    if (initialPanel) {
      lastModel = initialPanel.dataset["model"] ?? null;
      goToPanel(modelCarousel, initialPanel, true);
      if (lastModel) syncSubCarouselsToModel(lastModel, true);
    }

    return () => {
      modelCarousel.removeEventListener("scroll", onModelScroll);
      optionScrollHandlers.forEach(({ carousel, handler }) =>
        carousel.removeEventListener("scroll", handler),
      );
      panelClickHandlers.forEach(({ el, handler }) =>
        el.removeEventListener("click", handler),
      );
      cancelers.forEach((cancel) => cancel());
    };
  }, []);

  return (
    <div id="suit-configurator-widget" ref={widgetRef}>
      <style>{WIDGET_CSS}</style>
      <div className="model-selector-container">
        <div className="model-carousel-clip">
          <div className="model-carousel-fade left" />
          <div className="model-carousel-fade right" />
          <div className="model-carousel-container" id="main-model-carousel">
            <div className="model-track">
              {MODEL_PANELS.map((panel) => (
                <div
                  className="model-panel"
                  data-model={panel.model}
                  key={panel.model}
                >
                  <div className="model-panel-visual">
                    {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
                    <img src={panel.img} alt={panel.alt} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="carousel-stack">
        <div className="carousel-row">
          <div className="carousel-row-title">Lapel</div>
          <div className="carousel-clip">
            <div className="carousel-container" id="lapel-carousel">
              <div className="carousel-track">
                {LAPEL_PANELS.map((panel, index) => (
                  <div
                    className="carousel-panel"
                    data-panel-index={index}
                    key={panel.value}
                  >
                    <div className="panel-image-container">
                      {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
                      <img
                        className="panel-image"
                        id={panel.isDdTarget ? "dd-image-target" : undefined}
                        src={panel.img}
                        alt=""
                      />
                    </div>
                    <div className="panel-label">{panel.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="selection-indicator" />
        </div>

        <div className="carousel-row">
          <div className="carousel-row-title">Pockets</div>
          <div className="carousel-clip">
            <div className="carousel-container" id="pockets-carousel">
              <div className="carousel-track">
                {POCKETS_PANELS.map((panel, index) => (
                  <div
                    className="carousel-panel"
                    data-panel-index={index}
                    key={panel.value}
                  >
                    <div className="panel-image-container">
                      {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
                      <img className="panel-image" src={panel.img} alt="" />
                    </div>
                    <div className="panel-label">{panel.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="selection-indicator" />
        </div>

        <div className="carousel-row">
          <div className="carousel-row-title">Shoulder</div>
          <div className="carousel-clip">
            <div className="carousel-container" id="shoulder-carousel">
              <div className="carousel-track">
                {SHOULDER_PANELS.map((panel, index) => (
                  <div
                    className="carousel-panel"
                    data-panel-index={index}
                    key={panel.value}
                  >
                    <div className="panel-image-container">
                      {/* eslint-disable-next-line @next/next/no-img-element -- byte-for-byte source markup */}
                      <img className="panel-image" src={panel.img} alt="" />
                    </div>
                    <div className="panel-label">{panel.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="selection-indicator" />
        </div>
      </div>
    </div>
  );
}
