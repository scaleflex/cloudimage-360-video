import { WebGLRenderer, SRGBColorSpace, PerspectiveCamera } from 'three';
import { getDevicePixelRatio } from '../utils/capabilities';

export interface RendererHandle {
  renderer: WebGLRenderer;
  canvas: HTMLCanvasElement;
  isContextLost: () => boolean;
  destroy: () => void;
}

export interface CreateRendererOptions {
  antialias?: boolean;
  /** Maximum DPR cap. Defaults to 2. */
  pixelRatio?: number;
}

/**
 * Create a sRGB-correct WebGL renderer that survives context loss.
 *
 * Settings that must be re-applied on `webglcontextrestored` are factored into
 * `applyDefaults()` so the listener can call them again — losing them after a
 * GPU reset is a classic source of "colors went wrong on tab return" bugs.
 */
export function createRenderer(options: CreateRendererOptions = {}): RendererHandle {
  const renderer = new WebGLRenderer({
    canvas: document.createElement('canvas'),
    antialias: options.antialias !== false,
    alpha: false,
    powerPreference: 'high-performance',
  });

  // Use the renderer's own canvas as the canonical reference — real Three.js
  // uses the canvas we passed in, mocks may create their own.
  const canvas = renderer.domElement;
  canvas.className = 'ci-360-video-canvas';

  const dprMax = options.pixelRatio ?? 2;
  const applyDefaults = (): void => {
    renderer.setPixelRatio(getDevicePixelRatio(dprMax));
    renderer.outputColorSpace = SRGBColorSpace;
  };
  applyDefaults();

  let contextLost = false;
  const onLost = (e: Event): void => {
    e.preventDefault(); // tell browser we'll handle restoration
    contextLost = true;
  };
  const onRestored = (): void => {
    contextLost = false;
    applyDefaults();
  };
  canvas.addEventListener('webglcontextlost', onLost as EventListener);
  canvas.addEventListener('webglcontextrestored', onRestored as EventListener);

  return {
    renderer,
    canvas,
    isContextLost: () => contextLost,
    destroy: () => {
      canvas.removeEventListener('webglcontextlost', onLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onRestored as EventListener);
      renderer.dispose();
    },
  };
}

export interface ResizeHandle {
  /** Manually re-measure the container and update camera + renderer. */
  apply: () => void;
  destroy: () => void;
}

/**
 * Observe container size and keep camera aspect + renderer size in sync.
 * Debounced 16 ms to avoid thrashing during rapid drags.
 */
export function handleResize(
  container: HTMLElement,
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
): ResizeHandle {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const apply = (): void => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false); // updateStyle=false: container owns CSS sizing
  };

  apply();

  const observer = new ResizeObserver(() => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(apply, 16);
  });
  observer.observe(container);

  return {
    apply,
    destroy: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      observer.disconnect();
    },
  };
}
