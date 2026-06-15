import type { CSSProperties, MutableRefObject } from 'react';
import type {
  CI360VideoConfig,
  CI360VideoInstance,
  ScreenPoint,
  ThreeObjects,
  ViewState,
} from '../core/types';

/** Props for `<CI360VideoViewer />`. Everything `CI360VideoConfig` exposes is
 *  passable as a prop; `src` is required. */
export interface CI360VideoViewerProps extends Partial<Omit<CI360VideoConfig, 'src'>> {
  src: string;
  className?: string;
  style?: CSSProperties;
}

/** Imperative handle for ref consumers. Mirrors the public instance API but
 *  with null-safe stubs so callers don't have to check readiness first. */
export interface CI360VideoViewerRef {
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  isPaused: () => boolean;
  getView: () => ViewState;
  setView: (view: Partial<ViewState>, animate?: boolean) => void;
  latLonToScreen: (lon: number, lat: number) => ScreenPoint;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  isFullscreen: () => boolean;
  enterVR: () => Promise<void>;
  setVRView: (on?: boolean) => void;
  isVRView: () => boolean;
  update: (config: Partial<CI360VideoConfig>) => void;
  destroy: () => void;
  getThreeObjects: () => ThreeObjects | null;
}

export type UseCI360VideoOptions = CI360VideoViewerProps;

export interface UseCI360VideoReturn {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  instance: MutableRefObject<CI360VideoInstance | null>;
  ready: boolean;
}
