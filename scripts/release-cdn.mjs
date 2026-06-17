#!/usr/bin/env node
// Thin wrapper around the shared Scaleflex release-cdn pipeline.
//   npm run release            # patch bump + CDN upload (npm/git disabled below)
//   npm run release -- minor   # minor bump
//
// CDN folder comes from FILEROBOT_CDN_FOLDER in .env.local
// (/plugins/cloudimage/360-video/{version}/ → https://cdn.cloudimage.io/360-video/{version}/360-video.min.js).
import { execSync } from "child_process";
import { resolve, dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const { run } = await import(
  pathToFileURL(join(homedir(), ".claude/skills/release-cdn/release-cdn.mjs")).href
);

run({
  root,
  artifacts: {
    plugin: {
      versionKey: "version",
      cdnFileName: "360-video.min.js",
      // cdnFolder omitted — uses FILEROBOT_CDN_FOLDER from .env.local
      build(version) {
        // Full build also runs the projection-registry integrity guard.
        execSync("npm run build", { stdio: "inherit", cwd: root });
        return resolve(root, "dist/360-video.min.js");
      },
    },
  },
  updateFiles: ["README.md"],
  // Full release: CDN upload + npm publish + git commit/tag/push.
  npmPublish: true,
  gitTagAndPush: true,
});
