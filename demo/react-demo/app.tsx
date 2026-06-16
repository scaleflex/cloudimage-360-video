import { useRef, useState } from 'react';
import { CI360VideoViewer, type CI360VideoViewerRef } from '../../src/react';

type Projection = 'equirectangular' | 'fisheye' | 'dual-fisheye';
type Stereo = 'mono' | 'top-bottom' | 'side-by-side';

export function App(): JSX.Element {
  const ref = useRef<CI360VideoViewerRef>(null);
  const [src, setSrc] = useState('');
  const [autoRotate, setAutoRotate] = useState(false);
  const [projection, setProjection] = useState<Projection>('equirectangular');
  const [stereo, setStereo] = useState<Stereo>('mono');

  return (
    <div style={{ maxWidth: 1200, margin: '32px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 4 }}>@scaleflex/360-video — React</h1>
      <p style={{ color: '#9aa0a6', marginTop: 0 }}>
        Imperative ref API + reactive props. Projection / stereo trigger a
        full re-init via React's keyed remount.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="url"
          placeholder="Equirectangular / fisheye MP4 URL (or .mpd / .m3u8)"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          style={{ flex: 1, padding: '8px 10px', minWidth: 280 }}
        />
        <button onClick={() => ref.current?.play()}>Play</button>
        <button onClick={() => ref.current?.pause()}>Pause</button>
        <button
          onClick={() => ref.current?.setView({ lon: 0, lat: 0, fov: 75 }, true)}
        >
          Reset view
        </button>
        <label>
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={(e) => setAutoRotate(e.target.checked)}
          />
          Auto-rotate
        </label>
        <label>
          Projection:&nbsp;
          <select value={projection} onChange={(e) => setProjection(e.target.value as Projection)}>
            <option value="equirectangular">Equirectangular</option>
            <option value="fisheye">Fisheye</option>
            <option value="dual-fisheye">Dual fisheye</option>
          </select>
        </label>
        <label>
          Stereo:&nbsp;
          <select value={stereo} onChange={(e) => setStereo(e.target.value as Stereo)}>
            <option value="mono">Mono</option>
            <option value="top-bottom">Top-Bottom</option>
            <option value="side-by-side">Side-by-Side</option>
          </select>
        </label>
      </div>

      {src && (
        <CI360VideoViewer
          // Re-mount on projection/stereo change — these affect mesh construction
          // and can't be updated in place.
          key={`${projection}|${stereo}|${src}`}
          ref={ref}
          src={src}
          projection={projection}
          stereo={stereo}
          autoplay
          muted
          loop
          autoRotate={autoRotate}
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            background: '#000',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />
      )}
    </div>
  );
}
