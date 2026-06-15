/// <reference types="vite/client" />

// Allow `import CSS_STRING from './styles/index.css?inline'` to type-check.
declare module '*.css?inline' {
  const css: string;
  export default css;
}

// Optional peer dependency — `hls.js` is dynamically imported by HLSAdapter
// when (and only when) a .m3u8 source is detected. We don't require consumers
// to install it, so we shim its types here.
declare module 'hls.js' {
  const Hls: any;
  export default Hls;
}

// Optional peer dependency — `dashjs` is dynamically imported by DashAdapter
// for `.mpd` sources. Same rationale as hls.js: don't force the install.
declare module 'dashjs' {
  const dashjs: any;
  export default dashjs;
}
