// Probe the live GitHub Pages demo via Chrome DevTools Protocol.
// Captures console messages, failed requests, and the WebGL canvas pixel stats
// so we can tell whether the 360 video texture actually renders.
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import http from 'node:http';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9224;
const URL = process.argv[2] || 'https://scaleflex.github.io/cloudimage-360-video/';

const child = spawn(CHROME, [
  '--headless=new',
  '--use-gl=angle', '--use-angle=swiftshader', // software WebGL so the sphere renders
  '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${PORT}`,
  '--no-sandbox', '--hide-scrollbars', '--mute-audio',
  '--window-size=1280,800', 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] });

const httpJson = (path) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port: PORT, path }, (res) => {
    let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => resolve(JSON.parse(b)));
  });
  req.on('error', reject); req.end();
});

async function main() {
  await wait(1500);
  let target;
  for (let i = 0; i < 10; i++) {
    const list = await httpJson('/json').catch(() => []);
    target = list.find((t) => t.type === 'page');
    if (target) break;
    await wait(500);
  }
  const ws = target.webSocketDebuggerUrl;
  const { WebSocket } = await import('ws').catch(() => ({ WebSocket: globalThis.WebSocket }));
  const sock = new WebSocket(ws);
  let id = 0; const send = (method, params = {}) => { sock.send(JSON.stringify({ id: ++id, method, params })); };
  const logs = []; const failed = [];
  await new Promise((res) => sock.on('open', res));
  sock.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    }
    if (m.method === 'Network.loadingFailed') failed.push(`${m.params.errorText} ${m.params.type}`);
  });
  const pending = new Map();
  sock.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
  const evaluate = (expression) => new Promise((res) => { const myId = ++id; pending.set(myId, res); sock.send(JSON.stringify({ id: myId, method: 'Runtime.evaluate', params: { expression, returnByValue: true } })); });

  send('Runtime.enable'); send('Network.enable'); send('Page.enable');
  send('Page.navigate', { url: URL });
  await wait(9000);

  // Inspect the canvas + video element state.
  const stateRes = await evaluate(`(() => {
    const c = document.querySelector('canvas');
    const v = document.querySelector('video');
    let nonBlack = null;
    if (c) { try { const g = document.createElement('canvas'); g.width=c.width; g.height=c.height;
      const ctx = g.getContext('2d'); ctx.drawImage(c,0,0); const d = ctx.getImageData(0,0,g.width,g.height).data;
      let n=0; for (let i=0;i<d.length;i+=4){ if (d[i]+d[i+1]+d[i+2] > 30) n++; } nonBlack = (n/(d.length/4)*100).toFixed(1)+'%'; } catch(e){ nonBlack='err:'+e.message; } }
    return JSON.stringify({
      hasCanvas: !!c, canvasSize: c ? c.width+'x'+c.height : null, canvasNonBlack: nonBlack,
      hasVideo: !!v, videoReadyState: v?.readyState, videoW: v?.videoWidth, videoH: v?.videoHeight,
      videoErr: v?.error?.code, videoSrc: v?.currentSrc?.slice(0,80), paused: v?.paused,
    });
  })()`);
  console.log('STATE', stateRes?.result?.value);

  console.log('\n=== CONSOLE ==='); logs.slice(-40).forEach((l) => console.log(l));
  console.log('\n=== FAILED REQUESTS ==='); [...new Set(failed)].slice(0, 20).forEach((l) => console.log(l));
  child.kill(); process.exit(0);
}
main().catch((e) => { console.error(e); child.kill(); process.exit(1); });
