// Inspect HLS quality state inside <ci-360-video>'s shadow root after a long wait.
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import http from 'node:http';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9242;
const URL = process.argv[2];
const WAIT = Number(process.argv[3] || 30000);

const child = spawn(CHROME, [
  '--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`, '--no-sandbox', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', '--window-size=900,600', 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

const httpJson = (p) => new Promise((res, rej) => {
  const r = http.request({ hostname: '127.0.0.1', port: PORT, path: p }, (x) => {
    let b = ''; x.on('data', (d) => (b += d)); x.on('end', () => res(JSON.parse(b)));
  });
  r.on('error', rej); r.end();
});

async function main() {
  await wait(1500);
  let t;
  for (let i = 0; i < 10; i++) { const l = await httpJson('/json').catch(() => []); t = l.find((x) => x.type === 'page'); if (t) break; await wait(500); }
  const { WebSocket } = await import('ws');
  const s = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0; const pend = new Map();
  await new Promise((r) => s.on('open', r));
  s.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  const ev = (e) => new Promise((r) => { const i = ++id; pend.set(i, r); s.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true } })); });
  s.send(JSON.stringify({ id: ++id, method: 'Runtime.enable' }));
  s.send(JSON.stringify({ id: ++id, method: 'Page.enable' }));
  s.send(JSON.stringify({ id: ++id, method: 'Page.navigate', params: { url: URL } }));
  await wait(WAIT);
  const r = await ev(`(() => {
    const el = document.querySelector('ci-360-video');
    const sr = el && el.shadowRoot;
    const v = sr && sr.querySelector('video');
    const qBtn = sr && sr.querySelector('.ci-360-video-controls-quality-btn');
    const items = sr ? [...sr.querySelectorAll('.ci-360-video-dropdown-item, [data-id]')].map(n => (n.textContent||'').trim()+(n.getAttribute('aria-selected')==='true'||n.className.includes('active')?'*':'')) : [];
    return JSON.stringify({
      videoDims: v ? v.videoWidth + 'x' + v.videoHeight : null,
      readyState: v && v.readyState,
      qualityPillText: qBtn ? (qBtn.textContent || '').trim() : null,
      qualityBtnDisabled: qBtn ? (qBtn.disabled || qBtn.getAttribute('aria-disabled')) : null,
      qualityBtnTitle: qBtn ? qBtn.getAttribute('title') : null,
      dropdownItems: items,
      globalHls: typeof window.Hls,
      dbg: window.__dbg,
    });
  })()`);
  console.log('HLS', r?.result?.value);
  child.kill(); process.exit(0);
}
main().catch((e) => { console.error(e); child.kill(); process.exit(1); });
