import type { Object3D, Material, Texture } from 'three';

/**
 * Recursively dispose geometries, materials, and textures attached to an Object3D
 * tree. Deduplicates shared resources so they aren't disposed twice.
 *
 * `keep` lists textures owned by something else (e.g. the `VideoTexture`
 * managed by `createVideoTexture`, which has its own `destroy()` that also
 * cancels the frame callback). Those are skipped here so they aren't disposed
 * twice.
 *
 * Copied from `js-cloudimage-3d-view/src/utils/dispose.ts` — same pattern works
 * for a single textured sphere just as well as for a loaded glTF tree.
 */
export function disposeObject3D(object: Object3D, keep?: ReadonlySet<Texture>): void {
  const disposedMaterials = new Set<Material>();
  const disposedTextures = new Set<Texture>();

  object.traverse((child) => {
    const meshLike = child as Object3D & {
      geometry?: { dispose(): void };
      material?: Material | Material[];
    };

    if (meshLike.geometry) {
      meshLike.geometry.dispose();
    }

    if (meshLike.material) {
      const materials: Material[] = Array.isArray(meshLike.material)
        ? meshLike.material
        : [meshLike.material];

      for (const mat of materials) {
        if (!mat || disposedMaterials.has(mat)) continue;
        disposedMaterials.add(mat);

        for (const key of Object.keys(mat)) {
          const value = (mat as any)[key];
          if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture) {
            if (!disposedTextures.has(value) && !keep?.has(value as Texture)) {
              disposedTextures.add(value);
              (value as Texture).dispose();
            }
          }
        }
        mat.dispose();
      }
    }
  });
}
