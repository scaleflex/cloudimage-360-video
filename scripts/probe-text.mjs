// Navigate to a URL, wait, and dump visible body text + title + console (CDP).
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import http from 'node:http';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9240;
const URL = process.argv[2];
const WAIT = Number(process.argv[3] || 14000);

const child = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox',
  '--disable-gpu', '--window-size=1280,900', 'about:blank',
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
  let id = 0; const pend = new Map(); const logs = [];
  await new Promise((r) => s.on('open', r));
  s.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.method === 'Runtime.consoleAPICalled') logs.push('[' + m.params.type + '] ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  });
  const ev = (e) => new Promise((r) => { const i = ++id; pend.set(i, r); s.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: e, returnByValue: true } })); });
  s.send(JSON.stringify({ id: ++id, method: 'Runtime.enable' }));
  s.send(JSON.stringify({ id: ++id, method: 'Page.enable' }));
  s.send(JSON.stringify({ id: ++id, method: 'Page.navigate', params: { url: URL } }));
  await wait(WAIT);
  const r = await ev(`JSON.stringify({ title: document.title, text: (document.body && document.body.innerText || '').replace(/\\n+/g,' | ').slice(0, 700) })`);
  console.log('RESULT', r?.result?.value);
  if (logs.length) { console.log('CONSOLE:'); logs.slice(-12).forEach((l) => console.log(' ', l)); }
  child.kill(); process.exit(0);
}
main().catch((e) => { console.error(e); child.kill(); process.exit(1); });
