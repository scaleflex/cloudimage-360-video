import type { CSSProperties } from 'react';

// A verified, CORS-enabled 4K equirectangular 360° stream (HLS, via hls.js).
const SRC = 'https://scaleflex.filerobot.com/quqvv_vr-video-sample_auto/hls/video.m3u8';

// The <ci-360-video> element is registered by the CDN <script> in index.html
// (the self-contained bundle), so no npm install of the player/three is needed —
// the sandbox boots fast. React renders the custom element directly.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'ci-360-video': {
        src?: string;
        autoplay?: boolean;
        muted?: boolean;
        loop?: boolean;
        theme?: 'light' | 'dark';
        style?: CSSProperties;
      };
    }
  }
}

export default function App() {
  return (
    <main
      style={{
        maxWidth: 1000,
        margin: '0 auto',
        padding: 24,
        minHeight: '100vh',
        boxSizing: 'border-box',
        background: '#0d0d10',
        color: '#e6e6e8',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1>@cloudimage/360-video — React example</h1>
      <p>Drag to look around · scroll to zoom · toolbar for play / mute / quality / fullscreen.</p>

      <ci-360-video
        src={SRC}
        autoplay
        muted
        loop
        theme="dark"
        style={{
          display: 'block',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#000',
        }}
      />
    </main>
  );
}
