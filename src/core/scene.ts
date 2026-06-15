import { Scene, PerspectiveCamera, Color } from 'three';

export function createScene(): Scene {
  const scene = new Scene();
  scene.background = new Color(0x000000);
  return scene;
}

/**
 * Camera convention: positioned at the origin, never moves. The sphere
 * surrounds it. "Looking around" is implemented by changing where the camera
 * looks at, not where it sits.
 *
 * Near/far chosen so that the default 500-radius sphere is comfortably inside
 * the view frustum (sphere extends from radius ~1px-near to ~500 away).
 */
export function createCamera(aspect: number, fov = 75): PerspectiveCamera {
  const camera = new PerspectiveCamera(fov, aspect, 0.1, 1100);
  camera.position.set(0, 0, 0);
  return camera;
}
