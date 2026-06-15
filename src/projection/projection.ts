import type { BufferGeometry, Material, Texture } from 'three';
import type { Eye, StereoLayout } from '../texture/eye-mapping';

export interface ProjectionCreateGeometryOpts {
  segments: number;
  radius: number;
}

export interface ProjectionCreateMaterialOpts {
  eye?: Eye;
  layout?: StereoLayout;
  /** Per-lens field of view in degrees. Only used by fisheye projections;
   *  ignored elsewhere. Default 180. */
  lensFovDeg?: number;
}

/**
 * Strategy interface for source-side projection.
 *
 * A `Projection` knows how to turn a video texture into a mesh that, viewed
 * from the centre, looks correct. v1 implements only `equirectangular`;
 * adding `cubemap`, `eac`, or `fisheye` later is a new file implementing this
 * interface — the rest of the engine doesn't change.
 */
export interface Projection {
  readonly name: string;
  createGeometry(opts: ProjectionCreateGeometryOpts): BufferGeometry;
  createMaterial(texture: Texture, opts?: ProjectionCreateMaterialOpts): Material;
}

const registry = new Map<string, Projection>();

export function registerProjection(projection: Projection): void {
  registry.set(projection.name, projection);
}

export function getProjection(name: string): Projection {
  const p = registry.get(name);
  if (!p) {
    throw new Error(
      `CI360Video: unknown projection "${name}". Available: ${[...registry.keys()].join(', ') || '<none>'}.`,
    );
  }
  return p;
}

/** Test/diagnostics helper. Not part of the public API. */
export function _clearProjections(): void {
  registry.clear();
}
