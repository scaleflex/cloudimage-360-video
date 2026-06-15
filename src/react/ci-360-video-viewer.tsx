import { forwardRef, useImperativeHandle } from 'react';
import { useCI360Video } from './use-ci-360-video';
import type { CI360VideoViewerProps, CI360VideoViewerRef } from './types';

/**
 * React wrapper around `CI360Video`.
 *
 * Returns a single `<div ref={…} />` — all UI overlays (canvas, toolbar,
 * loading/error/activate overlays) are appended into it by the core class.
 * The imperative ref exposes the full player API to ref consumers.
 */
export const CI360VideoViewer = forwardRef<CI360VideoViewerRef, CI360VideoViewerProps>(
  function CI360VideoViewer(props, ref) {
    const { className, style, ...options } = props;
    const { containerRef, instance } = useCI360Video({ ...options, src: props.src, className, style });

    useImperativeHandle(
      ref,
      (): CI360VideoViewerRef => ({
        play: () => instance.current?.play() ?? Promise.resolve(),
        pause: () => instance.current?.pause(),
        seek: (t) => instance.current?.seek(t),
        setMuted: (m) => instance.current?.setMuted(m),
        isMuted: () => instance.current?.isMuted() ?? false,
        setVolume: (v) => instance.current?.setVolume(v),
        getVolume: () => instance.current?.getVolume() ?? 1,
        getCurrentTime: () => instance.current?.getCurrentTime() ?? 0,
        getDuration: () => instance.current?.getDuration() ?? 0,
        isPaused: () => instance.current?.isPaused() ?? true,
        getView: () => instance.current?.getView() ?? { lon: 0, lat: 0, fov: 75 },
        setView: (v, animate) => instance.current?.setView(v, animate),
        latLonToScreen: (lon, lat) =>
          instance.current?.latLonToScreen(lon, lat) ?? { x: 0, y: 0, visible: false },
        enterFullscreen: () => instance.current?.enterFullscreen(),
        exitFullscreen: () => instance.current?.exitFullscreen(),
        isFullscreen: () => instance.current?.isFullscreen() ?? false,
        enterVR: () => instance.current?.enterVR?.() ?? Promise.resolve(),
        setVRView: (on) => instance.current?.setVRView(on),
        isVRView: () => instance.current?.isVRView() ?? false,
        update: (config) => instance.current?.update(config),
        destroy: () => instance.current?.destroy(),
        getThreeObjects: () => instance.current?.getThreeObjects() ?? null,
      }),
      // `instance` is a stable ref object from useCI360Video, so this handle is
      // built once; listing it just satisfies react-hooks/exhaustive-deps.
      [instance],
    );

    return <div ref={containerRef} className={className} style={style} />;
  },
);
