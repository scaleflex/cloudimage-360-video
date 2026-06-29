import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProgressBar } from '../src/ui/progress-bar';

function dispatchKey(el: Element, key: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function dispatchPointer(el: Element, type: string, id: number, x: number, y: number): void {
  const ev = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'pointerId', { value: id, configurable: true });
  el.dispatchEvent(ev);
}

describe('progress-bar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('arrow-key seek nudges from the real current time, not the rounded percent', () => {
    // Regression: onKey reconstructed the position from the integer `aria-valuenow`
    // percent, so on a long video each press snapped to a coarse 1% grid.
    const onSeek = vi.fn();
    const pb = createProgressBar({ onSeek });
    document.body.appendChild(pb.element);
    pb.update(130, 7200, 0); // 2-hour video, currently at 130s
    const bar = pb.element.querySelector('[role="slider"]')!;
    dispatchKey(bar, 'ArrowRight');
    expect(onSeek).toHaveBeenCalledWith(135); // 130 + 5, NOT (round(1.8%)*7200)
    dispatchKey(bar, 'ArrowLeft');
    expect(onSeek).toHaveBeenLastCalledWith(125); // 130 - 5
    pb.destroy();
  });

  it('fill + handle follow the cursor during a drag, even with no onScrub wired', () => {
    // Regression: the toolbar wires only onSeek (no onScrub), so while dragging
    // nothing moved and an incoming video update() snapped the handle back to the
    // not-yet-sought playback time — the bar felt impossible to grab and drag.
    const onSeek = vi.fn();
    const pb = createProgressBar({ onSeek });
    document.body.appendChild(pb.element);
    const bar = pb.element.querySelector('.ci-360-video-progress-bar') as HTMLElement;
    bar.getBoundingClientRect = () => ({ left: 0, width: 100, top: 0, height: 4, right: 100, bottom: 4, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const fill = pb.element.querySelector('.ci-360-video-progress-fill') as HTMLElement;
    const handle = pb.element.querySelector('.ci-360-video-progress-handle') as HTMLElement;

    pb.update(10, 100, 0); // playback at 10% before the drag
    dispatchPointer(bar, 'pointerdown', 1, 80, 0);
    dispatchPointer(bar, 'pointermove', 1, 80, 0);
    expect(fill.style.width).toBe('80%');
    expect(handle.style.left).toBe('80%');

    // Video timeupdate during the drag must NOT snap the handle back to 10%.
    pb.update(10, 100, 0);
    expect(fill.style.width).toBe('80%');
    expect(handle.style.left).toBe('80%');

    dispatchPointer(bar, 'pointerup', 1, 80, 0);
    expect(onSeek).toHaveBeenCalledWith(80); // ratio 0.8 * duration 100
    pb.destroy();
  });

  it('pointercancel resets the drag without committing a seek', () => {
    // Regression: pointercancel ran the same handler as pointerup and seeked to
    // the cancel coordinate, jumping the video on an interrupted gesture.
    const onSeek = vi.fn();
    const onDragEnd = vi.fn();
    const pb = createProgressBar({ onSeek, onDragEnd });
    document.body.appendChild(pb.element);
    pb.update(10, 100, 0); // duration > 0 so a drag can start
    const bar = pb.element.querySelector('.ci-360-video-progress-bar')!;
    dispatchPointer(bar, 'pointerdown', 1, 50, 0);
    dispatchPointer(bar, 'pointercancel', 1, 50, 0);
    expect(onSeek).not.toHaveBeenCalled();
    expect(onDragEnd).toHaveBeenCalled();
    pb.destroy();
  });
});
