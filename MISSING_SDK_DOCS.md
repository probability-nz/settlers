# Missing SDK Docs Notes

These are the gaps I hit while making this example from the local SDK and Probability app code.

## SDK / Manifest Docs

- Add a static package authoring guide. The SDK README mostly points elsewhere, but this workflow needs an end-to-end guide for a generated package directory such as `dist/`.
- Document the package entrypoint contract explicitly: Probability fetches `<template-url>/package.json`, reads `main`, then fetches that manifest relative to the package root.
- Show the recommended generated layout:
  - `dist/package.json`
  - `dist/probability.json`
  - `dist/models/*.gltf`
  - `dist/models/*.bin`
  - optional external texture files such as `dist/models/*.png`
- Document that template URLs should be directory URLs with a trailing slash. Relative manifest `src` values are resolved from the manifest/package location, so `src: "models/foo.gltf"` works when the template URL is `/dist/`.
- Update the manifest docs around color. `@probability-nz/types` still mentions `color`, but the play app uses `tint` and warns that `color` is deprecated.
- State the preferred 3D asset publishing format. This example uses split `.gltf` rather than `.glb` because external buffers/textures can be cached independently, loaded progressively, and deduped across reused assets.
- Explain glTF external-file requirements. Buffers and images should be external relative URIs, not absolute URLs or embedded `data:` URIs, if the package wants cacheable/dedupable assets.
- Include a complete static game example using `templates`, one `scenarios` entry, glTF model assets, external buffers, external texture images, `locked` pieces, `tint`, and nested `children`.
- Explain positioning in meters. Static package examples should cover both `position: [x, null, z]` for implicit tabletop settling and explicit Y placement for deterministic generated packages.
- Explain model-origin assumptions for explicit Y. With vertically centered models, top-level flat pieces sit at `y = thickness / 2`; child pieces sitting on a parent use `parentThickness / 2 + childThickness / 2`; stacked children step by a full thickness.
- Make the scene tree model explicit. `children` is the object/game hierarchy, not a flat scene list. Board pieces should be children of the board they sit on, counters/cards should be children of the item beneath them, and stacked cards/pieces should be nested in stack order.
- Document parent transform semantics. Child positions are parent-relative, but current table semantics do not inherit parent rotation into child rotation, so flipping a stack root does not flip the cards nested inside it.
- Document `locked` behavior in a static-game authoring guide.

## Play Loader / Local Dev Docs

- Document the launch hash format: `#template=<url>&sync=<url>` and optionally `&plugin=<url>`.
- Document the canonical app URL as `https://prob.nz/play`; `https://probability.nz/play` redirects.
- Document cross-origin behavior. `prob.nz/play` fetches the template package and all model assets from the template origin. Hosted packages need CORS headers. Localhost packages loaded directly by hosted `prob.nz/play` can trigger browser Local Network Access / Private Network Access prompts or fail; a same-origin local proxy is the reliable development path.
- Provide a minimal local dev recipe. In this example Vite serves `/dist/` as the template package, redirects `/` to `prob.nz/play`, proxies `/play` from the same local origin, and uses a strict fixed port.
