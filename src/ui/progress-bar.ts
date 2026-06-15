import { addClass, createElement, removeClass } from '../utils/dom';
import { addListener } from '../utils/events';
import { formatTime } from '../utils/time';

export interface ProgressBarOptions {
  /** Fires on click and on drag release — caller seeks the video. */
  onSeek: (time: number) => void;
  /** Fires continuously while dragging — use for scrub previews. */
  onScrub?: (time: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export interface ProgressBar {
  readonly element: HTMLElement;
  /** Update visuals + ARIA. `duration<=0` or non-finite renders an empty state. */
  update(currentTime: number, duration: number, bufferedEnd: number): void;
  destroy(): void;
}

/**
 * Click + drag seek bar matching the `@cloudimage/video-hotspot` visual:
 * red fill (themable via `--ci-360-video-progress-fill`), buffered underlay,
 * scale-in handle on hover/drag, and a time-label tooltip that follows the
 * cursor along the bar.
 */
export function createProgressBar(opts: ProgressBarOptions): ProgressBar {
  const root = createElement('div', 'ci-360-video-progress');
  const bar = createElement('div', 'ci-360-video-progress-bar', {
    role: 'slider',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': '0',
    'aria-valuetext': '0:00 of 0:00',
    'aria-label': 'Video progress',
    tabindex: '0',
  });
  const buffered = createElement('div', 'ci-360-video-progress-buffered');
  const fill = createElement('div', 'ci-360-video-progress-fill');
  const handle = createElement('div', 'ci-360-video-progress-handle');
  const tooltip = createElement('div', 'ci-360-video-progress-tooltip');

  bar.appendChild(buffered);
  bar.appendChild(fill);
  bar.appendChild(handle);
  root.appendChild(bar);
  root.appendChild(tooltip);

  let dragging = false;
  let lastDuration = 0;
  let lastCurrentTime = 0;

  const xToTime = (clientX: number): number => {
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * lastDuration;
  };

  const positionTooltip = (clientX: number, time: number): void => {
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    tooltip.style.left = `${x + 12}px`; // 12px padding offset of root
    tooltip.textContent = formatTime(time);
  };

  const onHover = (e: PointerEvent): void => {
    if (lastDuration <= 0) return;
    const t = xToTime(e.clientX);
    positionTooltip(e.clientX, t);
    addClass(tooltip, 'ci-360-video-progress-tooltip--visible');
  };

  const onLeave = (): void => {
    if (dragging) return;
    removeClass(tooltip, 'ci-360-video-progress-tooltip--visible');
  };

  const onDown = (e: PointerEvent): void => {
    if (lastDuration <= 0) return;
    dragging = true;
    addClass(root, 'ci-360-video-progress--dragging');
    addClass(tooltip, 'ci-360-video-progress-tooltip--visible');
    try { bar.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    opts.onDragStart?.();
    const t = xToTime(e.clientX);
    positionTooltip(e.clientX, t);
    opts.onScrub?.(t);
  };

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const t = xToTime(e.clientX);
    positionTooltip(e.clientX, t);
    opts.onScrub?.(t);
  };

  const onUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    removeClass(root, 'ci-360-video-progress--dragging');
    removeClass(tooltip, 'ci-360-video-progress-tooltip--visible');
    try { if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const t = xToTime(e.clientX);
    opts.onSeek(t);
    opts.onDragEnd?.();
  };

  // pointercancel = the gesture was interrupted (system gesture, scroll, etc.).
  // Reset drag UI but DON'T commit a seek to the cancel coordinate — the user
  // never released to confirm a position.
  const onCancel = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    removeClass(root, 'ci-360-video-progress--dragging');
    removeClass(tooltip, 'ci-360-video-progress-tooltip--visible');
    try { if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    opts.onDragEnd?.();
  };

  // Keyboard support for ARIA slider.
  const onKey = (e: KeyboardEvent): void => {
    if (lastDuration <= 0) return;
    let delta = 0;
    if (e.key === 'ArrowLeft') delta = -5;
    else if (e.key === 'ArrowRight') delta = 5;
    else if (e.key === 'Home') { opts.onSeek(0); e.preventDefault(); return; }
    else if (e.key === 'End') { opts.onSeek(lastDuration); e.preventDefault(); return; }
    else return;
    e.preventDefault();
    // Nudge from the real current time, NOT the rounded integer `aria-valuenow`
    // percent — on long videos 1% is many seconds, so reconstructing from it
    // snapped the seek to a coarse grid instead of moving by `delta`.
    opts.onSeek(Math.max(0, Math.min(lastDuration, lastCurrentTime + delta)));
  };

  const cleanups = [
    addListener(bar, 'pointerdown', onDown as EventListener),
    addListener(bar, 'pointermove', onMove as EventListener),
    addListener(bar, 'pointerup', onUp as EventListener),
    addListener(bar, 'pointercancel', onCancel as EventListener),
    addListener(root, 'pointermove', onHover as EventListener),
    addListener(root, 'pointerleave', onLeave as EventListener),
    addListener(bar, 'keydown', onKey as EventListener),
  ];

  return {
    element: root,
    update(currentTime, duration, bufferedEnd) {
      lastDuration = duration;
      lastCurrentTime = currentTime;
      if (!isFinite(duration) || duration <= 0) {
        fill.style.width = '0%';
        buffered.style.width = '0%';
        handle.style.left = '0%';
        bar.setAttribute('aria-valuenow', '0');
        bar.setAttribute('aria-valuetext', '0:00 of 0:00');
        return;
      }
      const pct = Math.max(0, Math.min(100, (currentTime / duration) * 100));
      const bufPct = Math.max(0, Math.min(100, (bufferedEnd / duration) * 100));
      fill.style.width = `${pct}%`;
      buffered.style.width = `${bufPct}%`;
      handle.style.left = `${pct}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(pct)));
      bar.setAttribute('aria-valuetext', `${formatTime(currentTime)} of ${formatTime(duration)}`);
    },
    destroy() {
      cleanups.forEach((fn) => fn());
      root.remove();
    },
  };
}
