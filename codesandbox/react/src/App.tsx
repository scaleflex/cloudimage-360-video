import { useRef } from 'react';
import { CI360VideoViewer, type CI360VideoViewerRef } from '@cloudimage/360-video/react';

// A verified, CORS-enabled equirectangular 360° MP4.
const SRC =
  'https://scaleflex.filerobot.com/plugins/cloudimage/player-360/jfk_720p_400K_compressed.mp4?func=proxy';

export default function App() {
  const ref = useRef<CI360VideoViewerRef>(null);

  return (
    <main
      style={{
        maxWidth: 900,
        margin: '32px auto',
        padding: '0 16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>@cloudimage/360-video — React example</h1>
      <p>Drag to look around · scroll to zoom · use the toolbar to play / mute / fullscreen.</p>

      <CI360VideoViewer
        ref={ref}
        src={SRC}
        autoplay
        muted
        loop
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#000',
        }}
        onReady={() => console.log('ready', ref.current?.getView())}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => ref.current?.play()}>Play</button>
        <button onClick={() => ref.current?.pause()}>Pause</button>
        <button onClick={() => ref.current?.setView({ lon: 0, lat: 0, fov: 75 }, true)}>
          Reset view
        </button>
      </div>
    </main>
  );
}
