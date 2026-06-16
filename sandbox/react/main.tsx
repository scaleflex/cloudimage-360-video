import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CI360VideoViewer } from '@scaleflex/360-video/react';
import type { CI360VideoViewerRef, ViewState } from '@scaleflex/360-video/react';

/** Verified live, CORS-enabled 360° sources (same set the landing demo uses). */
const SOURCES = [
  { label: '4K · HLS', src: 'https://scaleflex.filerobot.com/quqvv_vr-video-sample_auto/hls/video.m3u8' },
  { label: 'Lake · HLS', src: 'https://scaleflex.filerobot.com/yeswy_Enhanced_Test_Lake_Video_w_Music_auto/hls/video.m3u8' },
  { label: 'Stereo · top-bottom', src: 'https://scaleflex.cloudimg.io/v7/plugins/cloudimage/player-360/congo.mp4?vh=4590b0&func=proxy' },
];

const PAN_STEP = 20;
const TILT_STEP = 10;
const FOV_STEP = 10;

function App() {
  const ref = useRef<CI360VideoViewerRef>(null);
  const [source, setSource] = useState(0);
  const [state, setState] = useState('—');

  const refresh = () => {
    const v: ViewState | undefined = ref.current?.getView();
    if (!v) return;
    setState(
      JSON.stringify(
        {
          view: { lon: Math.round(v.lon), lat: Math.round(v.lat), fov: Math.round(v.fov) },
          paused: ref.current?.isPaused() ?? true,
        },
        null,
        2,
      ),
    );
  };

  // Animated view nudges through the imperative ref.
  const panBy = (deg: number) => {
    const v = ref.current?.getView();
    if (v) ref.current?.setView({ lon: v.lon + deg }, true);
  };
  const tiltBy = (deg: number) => {
    const v = ref.current?.getView();
    if (v) ref.current?.setView({ lat: v.lat + deg }, true);
  };
  const zoomBy = (deg: number) => {
    const v = ref.current?.getView();
    if (v) ref.current?.setView({ fov: v.fov + deg }, true);
  };
  const playPause = () => {
    if (ref.current?.isPaused()) void ref.current.play();
    else ref.current?.pause();
  };

  return (
    <>
      <a className="back" href="../index.html">← Sandbox</a>
      <h1>React — &lt;CI360VideoViewer&gt;</h1>
      <p className="lead">
        Drag to look around, scroll to zoom. Pick a source, or drive the view through the imperative ref.
      </p>
      <div className="hint">
        The buttons call <code>getView()</code> / <code>setView()</code> (animated) and
        <code> play()</code> / <code>pause()</code> on the ref.
      </div>

      <div className="controls">
        <label>
          Source:{' '}
          <select value={source} onChange={(e) => setSource(Number(e.target.value))}>
            {SOURCES.map((s, i) => (
              <option key={s.src} value={i}>{s.label}</option>
            ))}
          </select>
        </label>
        <button onClick={() => panBy(-PAN_STEP)}>Pan ←</button>
        <button onClick={() => panBy(PAN_STEP)}>Pan →</button>
        <button onClick={() => tiltBy(TILT_STEP)}>Look ↑</button>
        <button onClick={() => tiltBy(-TILT_STEP)}>Look ↓</button>
        <button onClick={() => zoomBy(-FOV_STEP)}>Zoom in</button>
        <button onClick={() => zoomBy(FOV_STEP)}>Zoom out</button>
        <button onClick={() => ref.current?.setView({ lon: 0, lat: 0, fov: 75 }, true)}>Reset view</button>
        <button onClick={playPause}>Play / Pause</button>
      </div>

      <CI360VideoViewer
        ref={ref}
        // `key` forces a fresh instance when the source changes.
        key={SOURCES[source].src}
        src={SOURCES[source].src}
        autoplay
        muted
        loop
        className="player"
        onReady={refresh}
        onViewChange={refresh}
        onPlay={refresh}
        onPause={refresh}
      />

      <h3>Live view state</h3>
      <pre id="state">{state}</pre>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
