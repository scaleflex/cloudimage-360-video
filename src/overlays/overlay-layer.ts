import type { PerspectiveCamera } from 'three';
import type { ViewStateManager } from '../controls/view-state';

export interface OverlayEntry {
  id: string;
  lon: number;
  lat: number;
  element: HTMLElement;
}

export interface OverlayLayerHandle {
  /** Add or replace an overlay anchored at `(lon, lat)` on the sphere. */
  register(entry: OverlayEntry): void;
  unregister(id: string): void;
  /** Re-project every anchor and write its CSS position. Called per tick. */
  update(): void;
  destroy(): void;
}

/**
 * Extension hook for the future hotspot / annotation layer.
 *
 * Maintains a flat list of `(lon, lat) → DOM element` anchors. Each tick the
 * layer asks `ViewStateManager.latLonToScreen` for each anchor's pixel
 * coordinates and writes `transform: translate(...)`. Anchors that the
 * projection reports as not visible (behind the camera, outside the frustum)
 * get `display: none` so they don't capture clicks or eat layout.
 *
 * v1 ships the engine but no hotspot UI — that's a separate plugin that
 * sits on this hook. Authors with deeper needs (rendering 3D meshes as
 * hotspots, raycasting, …) can fall back to `getThreeObjects()` for direct
 * Three.js access.
 */
export function createOverlayLayer(
  container: HTMLElement,
  camera: PerspectiveCamera,
  view: ViewStateManager,
): OverlayLayerHandle {
  const layer = document.createElement('div');
  layer.className = 'ci-360-video-overlays';
  layer.style.position = 'absolute';
  layer.style.inset = '0';
  layer.style.pointerEvents = 'none';
  container.appendChild(layer);

  const entries = new Map<string, OverlayEntry>();

  return {
    register(entry) {
      // Caller's element may be re-used across calls; rip it out of any prior
      // parent before re-mounting under our layer.
      const el = entry.element;
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      el.style.transformOrigin = '50% 50%';
      el.style.willChange = 'transform';
      el.style.pointerEvents = 'auto';

      const prev = entries.get(entry.id);
      if (prev && prev.element !== el) prev.element.remove();
      if (!el.parentNode) layer.appendChild(el);
      entries.set(entry.id, entry);
    },
    unregister(id) {
      const e = entries.get(id);
      if (!e) return;
      e.element.remove();
      entries.delete(id);
    },
    update() {
      if (entries.size === 0) return;
      for (const entry of entries.values()) {
        const p = view.latLonToScreen(camera, container, entry.lon, entry.lat);
        if (!p.visible) {
          entry.element.style.display = 'none';
          continue;
        }
        entry.element.style.display = '';
        entry.element.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      }
    },
    destroy() {
      entries.clear();
      layer.remove();
    },
  };
}
