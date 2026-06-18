# Missing SDK Docs Notes

These are the gaps I hit while making this example from the local SDK and Probability app code.

- The SDK README mostly links to hosted docs and does not include a local guide for a static game package.
- The package entrypoint contract is not described in the README: Probability loads `package.json`, reads its `main` field, then fetches the manifest from that relative path.
- The manifest docs in `@probability-nz/types` still describe `color`, but the current play app uses `tint` and warns that `color` is deprecated.
- The docs do not show a complete static game package with glTF assets, `templates`, and a single `scenarios` entry.
- The docs mention model paths as glTF/GLB, but do not state the preferred publishing standard. This example now uses split `.gltf` assets because external buffers/textures can be cached independently, loaded progressively, and deduped across reused assets.
- The docs do not spell out the launch hash for templates. I found the `#template=<url>&sync=<url>` flow in the play app tests.
- Cross-origin loading requirements are not documented. `prob.nz/play` fetches package manifests and model assets from the template origin, so hosted template packages need CORS headers. For local development, the reliable pattern is to serve the template and proxy `/play` from the same local origin; asking hosted `https://prob.nz/play` to read `http://127.0.0.1` triggers browser Local Network Access / Private Network Access prompts or blocks.
- The local dev example should use a strict fixed port. Vite's default fallback to another port can leave an older server answering the documented URL, which makes CORS fixes look broken.
- The canonical app URL should be documented as `https://prob.nz/play`; `https://probability.nz/play` redirects.
- Asset URL rules are only discoverable from code: manifest and template `src` values are resolved relative to the manifest file, and the template URL must end with `/`.
- There is no practical guide for positioning pieces in meters. Static package examples should explain both options: `position: [x, null, z]` for implicit tabletop settling, and explicit Y placement for deterministic examples.
- Explicit Y placement needs a clear model-origin convention. If models are centered vertically, top-level pieces sit at `y = thickness / 2`; child pieces sitting on a parent need `parentThickness / 2 + childThickness / 2`, and stacks need a full-thickness step between children.
- The docs say positions are parent-relative, but the examples should make the tree model explicit: `children` is the game/object hierarchy, not a flat scene list. Board pieces should be children of the board/ocean/card they sit on, and stacked items should be nested under the thing they sit on.
- The behavior of `locked` pieces is not covered in a static-game authoring guide.
