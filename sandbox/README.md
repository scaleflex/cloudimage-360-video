# Sandbox

Minimal standalone demos that run the player straight from `src/` (no build
step), focused on **drag-to-look**, **scroll-to-zoom**, and the
`getView()` / `setView()` view API.

```bash
npm run sandbox
```

Vite serves on <http://localhost:4000/>:

- **`vanilla/`** — `new CI360Video(el, {…})` plus buttons that drive the view
  through `getView()` / `setView()` and `play()` / `pause()`.
- **`react/`** — the `<CI360VideoViewer>` component driven through its imperative
  ref (`CI360VideoViewerRef`).

In both: drag inside the player to look around, scroll to zoom (FOV), and use
the buttons to pan/tilt/zoom programmatically or switch the source. The live
`{ lon, lat, fov }` view state is shown below the player.

The CSS is injected by the core at runtime, so no stylesheet import is needed.
The package specifiers (`@scaleflex/360-video`, `/react`, `/css`) are aliased
to the local `src/` in `vite.config.ts`.
