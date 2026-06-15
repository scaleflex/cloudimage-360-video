import { vi } from 'vitest';

// ---- ResizeObserver ----
class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
globalThis.ResizeObserver = MockResizeObserver as any;

// ---- requestAnimationFrame / cancelAnimationFrame ----
let rafId = 0;
globalThis.requestAnimationFrame = vi.fn((_cb: FrameRequestCallback) => ++rafId) as any;
globalThis.cancelAnimationFrame = vi.fn() as any;

// ---- matchMedia ----
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---- WebGL context mock (jsdom has no real WebGL) ----
const mockWebGLContext = {
  getExtension: vi.fn(() => null),
  getParameter: vi.fn((p: number) => {
    // gl.MAX_TEXTURE_SIZE = 0x0d33
    if (p === 0x0d33) return 8192;
    return 0;
  }),
  createBuffer: vi.fn(),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  clear: vi.fn(),
  viewport: vi.fn(),
  createShader: vi.fn(() => ({})),
  shaderSource: vi.fn(),
  compileShader: vi.fn(),
  getShaderParameter: vi.fn(() => true),
  createProgram: vi.fn(() => ({})),
  attachShader: vi.fn(),
  linkProgram: vi.fn(),
  getProgramParameter: vi.fn(() => true),
  useProgram: vi.fn(),
  createTexture: vi.fn(() => ({})),
  bindTexture: vi.fn(),
  texParameteri: vi.fn(),
  texImage2D: vi.fn(),
  createFramebuffer: vi.fn(() => ({})),
  bindFramebuffer: vi.fn(),
  framebufferTexture2D: vi.fn(),
  createRenderbuffer: vi.fn(() => ({})),
  bindRenderbuffer: vi.fn(),
  renderbufferStorage: vi.fn(),
  drawArrays: vi.fn(),
  drawElements: vi.fn(),
  getShaderInfoLog: vi.fn(() => ''),
  getProgramInfoLog: vi.fn(() => ''),
  canvas: document.createElement('canvas'),
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  contextId: string,
  options?: any,
) {
  if (contextId === 'webgl' || contextId === 'webgl2') {
    return mockWebGLContext as any;
  }
  return (originalGetContext as any).call(this, contextId, options);
} as any;

// ---- HTMLMediaElement / HTMLVideoElement mocks ----
// jsdom doesn't implement media playback. Stub the essentials so adapter/tests can run.
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn(function (this: HTMLMediaElement) {
    // Mimic browser dispatching 'play' on a successful play() call.
    queueMicrotask(() => this.dispatchEvent(new Event('play')));
    return Promise.resolve();
  }),
});
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(function (this: HTMLMediaElement) {
    queueMicrotask(() => this.dispatchEvent(new Event('pause')));
  }),
});
Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: vi.fn(),
});
// requestVideoFrameCallback — Chrome/Safari API used to drive texture updates.
Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
  configurable: true,
  value: vi.fn((_cb: VideoFrameRequestCallback) => 1),
});
Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
  configurable: true,
  value: vi.fn(),
});

// ---- Three.js WebGLRenderer mock ----
class MockWebGLRenderer {
  domElement = document.createElement('canvas');
  shadowMap = { enabled: false, type: 0 };
  toneMapping = 0;
  toneMappingExposure = 1;
  outputColorSpace = 'srgb';
  xr = { enabled: false, isPresenting: false };
  setSize = vi.fn();
  setPixelRatio = vi.fn();
  render = vi.fn();
  dispose = vi.fn();
  getContext = vi.fn(() => mockWebGLContext);
  setViewport = vi.fn();
  setScissor = vi.fn();
  setScissorTest = vi.fn();
  getSize = vi.fn((target?: { x: number; y: number }) => {
    if (target) {
      target.x = 800;
      target.y = 600;
      return target;
    }
    return { width: 800, height: 600 };
  });
  setClearColor = vi.fn();
  setAnimationLoop = vi.fn();
  getRenderTarget = vi.fn(() => null);
  setRenderTarget = vi.fn();
  clear = vi.fn();
  info = { render: { frame: 0 }, memory: {} };
  capabilities = { isWebGL2: true, maxTextures: 16, getMaxAnisotropy: () => 1 };
  properties = { get: vi.fn(() => ({})) };
  state = { reset: vi.fn() };
}

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});
