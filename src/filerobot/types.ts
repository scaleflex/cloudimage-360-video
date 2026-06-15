/**
 * Minimal structural shape of a `FilerobotFile` — only the fields this helper
 * reads. We define our own interface (not import from `@filerobot/core`)
 * because:
 *
 *   1. Filerobot must not become a hard dependency of the 360 plugin —
 *      external open-source consumers should not be forced to install or know
 *      about Scaleflex's internal SDK.
 *   2. TypeScript's structural typing means any object that *has* these fields
 *      satisfies the type, regardless of what package declared it. The real
 *      `FilerobotFile` from `@filerobot/core` satisfies this shape, so the
 *      helper accepts it transparently inside Scaleflex products.
 *
 * If Filerobot ever renames a field this is the one place to adjust.
 */
export interface FilerobotFileLike {
  /** CDN URLs for the original (un-transcoded) asset. */
  url?: {
    cdn?: string;
    permalink?: string;
  };
  /**
   * Per-file metadata. The transcoder writes `playlists[0]` with an
   * `.m3u8` URL once HLS adaptive streaming is enabled in the Filerobot
   * Project's storage settings.
   *
   * The shape is double-nested because the BE has historically returned
   * either `{ playlists: ['url'] }` or just the URL string at this slot.
   */
  info?: {
    playlists?: Array<{ playlists?: string[] } | string>;
    poster?: string;
    /**
     * Output of Filerobot's **Compression** feature: one separately-encoded
     * MP4 per resolution. The BE returns either a single URL string or an
     * array of them. The resolution is encoded in each filename
     * (`name_720p_400K_compressed.mp4`), which `pickFilerobotVideoSources`
     * parses into a label. This is the "each quality is its own link" model —
     * distinct from `playlists` (HLS adaptive, one `.m3u8`).
     */
    compressed?: string | string[];
  };
  /** MIME type, e.g. `'video/mp4'`. */
  type?: string;
}

/** Source classification returned by `pickFilerobotVideoUrl`. */
export type FilerobotSourceKind = 'hls' | 'mp4' | 'unknown';

export interface FilerobotVideoSource {
  src: string;
  kind: FilerobotSourceKind;
}

/**
 * One pre-encoded compression variant, shaped to match the player's
 * `VideoSource` so it can be spread straight into `config.sources`. Declared
 * locally (not imported from `../core/types`) to keep this subpath free of any
 * core import — same reason `FilerobotPlayerConfig` stays narrow.
 */
export interface FilerobotVideoVariant {
  src: string;
  label: string;
  height?: number;
  default?: boolean;
}

/** Subset of `CI360VideoConfig` returned by the convenience helper. Kept
 *  narrow on purpose so callers can spread it without worrying about
 *  field overrides. */
export interface FilerobotPlayerConfig {
  src: string;
  poster?: string;
  /** Present only when the file has Compression variants (`info.compressed`).
   *  Populates the player's quality dropdown with per-resolution files. */
  sources?: FilerobotVideoVariant[];
}
