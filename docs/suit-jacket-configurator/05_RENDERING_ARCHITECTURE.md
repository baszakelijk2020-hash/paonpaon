# Rendering architecture

## Decision

Use a deterministic WebGL-first renderer with static GLB state meshes and a semantic HTML/poster fallback. WebGPU is an enhancement research path, not a dependency: browser availability remains uneven. No runtime cloth solve in the browser.

Scene contract: fixed neutral background, ACES/sRGB-managed colour pipeline, one calibrated camera family, scene-specific light rigs/HDRIs, tone-map version, environment intensity and exact manifest version. Renderer loads lowest adequate LOD, aborts/cancels on route change, disposes GPU resources, handles `webglcontextlost`, and changes to poster mode after failure.

## Budgets

- Initial route JavaScript for the lab: <= 180 KB gzip before optional renderer chunk.
- Selected state model: <= 6 MB compressed on desktop; <= 3 MB mobile, one LOD.
- Mesh: <= 60k triangles desktop / 30k mobile per visible garment state; <= 4 texture maps at 1024² mobile.
- Interaction: control feedback <= 100 ms; asset state change target <= 1.5 s on fast 4G; display explicit loading otherwise.
- Idle renderer sleeps when hidden; no continuous animation for a static state.

## Progressive enhancement

Probe WebGL first, honor reduced motion, and show a labelled static poster and identical controls/text for WebGL unavailable, context-lost, failed asset and slow-network conditions. Canvas is never the only source of meaning.

## Sources

| Source                 | Organization  |          Date | URL                                                                            | Relevance / limitation                                                   |
| ---------------------- | ------------- | ------------: | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| WebGL specification    | Khronos Group | current draft | https://registry.khronos.org/webgl/specs/latest/1.0/                           | Context loss/fallback guidance; implementation still needs device tests. |
| WebGPU API             | MDN           |          2026 | https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API                    | Availability and secure-context caveat.                                  |
| prefers-reduced-motion | MDN           |          2026 | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion | Accessible motion preference.                                            |
