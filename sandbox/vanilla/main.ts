// Importing `/define` registers the <ci-360-video> custom element; the engine
// injects its CSS into the element's shadow root, so no stylesheet import.
import '@cloudimage/360-video/define';
import type { CI360VideoElement } from '@cloudimage/360-video';

/** Verified live, CORS-enabled 360° sources (same set the landing demo uses). */
const SOURCES = [
  { label: '4K · HLS', src: 'https://scaleflex.filerobot.com/quqvv_vr-video-sample_auto/hls/video.m3u8' },
  { label: 'Lake · HLS', src: 'https://scaleflex.filerobot.com/yeswy_Enhanced_Test_Lake_Video_w_Music_auto/hls/video.m3u8' },
  { label: 'Stereo · top-bottom', src: 'https://scaleflex.cloudimg.io/v7/plugins/cloudimage/player-360/congo.mp4?vh=4590b0&func=proxy' },
];

const PAN_STEP = 20; // degrees
const TILT_STEP = 10; // degrees
const FOV_STEP = 10; // degrees

const host = document.getElementById('player') as HTMLElement;
const sourceSelect = document.getElementById('source') as HTMLSelectElement;
const stateEl = document.getElementById('state') as HTMLElement;

let player: CI360VideoElement | null = null;

function showState(): void {
  if (!player) return;
  const v = player.getView();
  stateEl.textContent = JSON.stringify(
    {
      view: { lon: Math.round(v.lon), lat: Math.round(v.lat), fov: Math.round(v.fov) },
      paused: player.isPaused(),
    },
    null,
    2,
  );
}

function mount(src: string): void {
  // `src` is a re-init: remove the old element (destroys its engine) and build
  // a fresh one.
  player?.remove();
  const el = document.createElement('ci-360-video') as CI360VideoElement;
  el.style.cssText = 'display:block;width:100%;height:100%';
  el.config = {
    src,
    autoplay: true,
    muted: true,
    loop: true,
    onReady: showState,
    onViewChange: showState,
    onPlay: showState,
    onPause: showState,
  };
  host.appendChild(el);
  player = el;
}

// Populate the source dropdown and boot the first one.
sourceSelect.innerHTML = SOURCES.map(
  (s, i) => `<option value="${i}">${s.label}</option>`,
).join('');
sourceSelect.addEventListener('change', () => mount(SOURCES[Number(sourceSelect.value)].src));

// View controls — animated via setView(view, animate=true).
const panBy = (deg: number): void => player?.setView({ lon: player.getView().lon + deg }, true);
const tiltBy = (deg: number): void => player?.setView({ lat: player.getView().lat + deg }, true);
const zoomBy = (deg: number): void => player?.setView({ fov: player.getView().fov + deg }, true);

document.getElementById('pan-left')!.addEventListener('click', () => panBy(-PAN_STEP));
document.getElementById('pan-right')!.addEventListener('click', () => panBy(PAN_STEP));
document.getElementById('look-up')!.addEventListener('click', () => tiltBy(TILT_STEP));
document.getElementById('look-down')!.addEventListener('click', () => tiltBy(-TILT_STEP));
document.getElementById('zoom-in')!.addEventListener('click', () => zoomBy(-FOV_STEP)); // smaller FOV = zoom in
document.getElementById('zoom-out')!.addEventListener('click', () => zoomBy(FOV_STEP));
document.getElementById('reset')!.addEventListener('click', () => player?.setView({ lon: 0, lat: 0, fov: 75 }, true));
document.getElementById('playpause')!.addEventListener('click', () => {
  if (!player) return;
  if (player.isPaused()) void player.play();
  else player.pause();
});

mount(SOURCES[0].src);
