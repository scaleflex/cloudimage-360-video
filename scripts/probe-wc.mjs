// Probe a <ci-360-video> page, piercing the shadow root, via Chrome DevTools.
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import http from 'node:http';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9231;
const URL = process.argv[2] || 'http://localhost:4790/';

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
  let id = 0; const logs = []; const pend = new Map();
  await new Promise((r) => s.on('open', r));
  s.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  });
  const ev = (e) => new Promise((r) => { const i = ++id; pend.set(i, r); s.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true } })); });
  s.send(JSON.stringify({ id: ++id, method: 'Runtime.enable' }));
  s.send(JSON.stringify({ id: ++id, method: 'Page.enable' }));
  s.send(JSON.stringify({ id: ++id, method: 'Page.navigate', params: { url: URL } }));
  await wait(2500);
  // Optional pre-measure action (e.g. drive a React-controlled input).
  if (process.argv[3]) { await ev(process.argv[3]); await wait(7000); }
  else await wait(5500);
  const r = await ev(`(() => {
    const el = document.querySelector('ci-360-video');
    const v = el && el.shadowRoot && el.shadowRoot.querySelector('video');
    const c = el && el.shadowRoot && el.shadowRoot.querySelector('canvas');
    return JSON.stringify({
      defined: !!customElements.get('ci-360-video'),
      hasShadow: !!(el && el.shadowRoot),
      canvasInShadow: !!c,
      videoReadyState: v && v.readyState,
      videoDims: v ? v.videoWidth + 'x' + v.videoHeight : null,
      paused: v ? v.paused : null,
      styleInShadow: !!(el && el.shadowRoot && el.shadowRoot.querySelector('style#ci-360-video-styles')),
      styleInHead: !!document.head.querySelector('style#ci-360-video-styles'),
      result: window.__result,
    });
  })()`);
  console.log('STATE', r?.result?.value);
  if (logs.length) { console.log('CONSOLE:'); logs.slice(-10).forEach((l) => console.log(' ', l)); }
  child.kill(); process.exit(0);
}
main().catch((e) => { console.error(e); child.kill(); process.exit(1); });
