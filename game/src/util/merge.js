// Tiny static-geometry merger: many small boxes, cones and planes that
// share one material become a single draw call. Every geometry must carry
// position, normal and uv attributes and an index (Box, Plane, Cylinder,
// Cone and Sphere geometries all do). Transforms are baked in before the
// merge, so merged meshes never move — perfect for city scenery.

const THREE = window.THREE;

export function mergeGeometries(geometries) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const g of geometries) {
    vertexCount += g.attributes.position.count;
    // Polyhedron geometries (icosahedron) carry no index: each vertex is used once.
    indexCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(indexCount);
  let vOffset = 0;
  let iOffset = 0;
  for (const g of geometries) {
    positions.set(g.attributes.position.array, vOffset * 3);
    normals.set(g.attributes.normal.array, vOffset * 3);
    uvs.set(g.attributes.uv.array, vOffset * 2);
    if (g.index) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) {
        indices[iOffset + i] = src[i] + vOffset;
      }
    } else {
      for (let i = 0; i < g.attributes.position.count; i++) {
        indices[iOffset + i] = vOffset + i;
      }
    }
    vOffset += g.attributes.position.count;
    iOffset += g.index ? g.index.count : g.attributes.position.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

// Collect transformed geometries per material, then flush each bucket into
// one mesh. Call add() for every static piece, flush() once at the end.
export class GeometryBuckets {
  constructor(scene) {
    this.scene = scene;
    this.buckets = new Map();
  }

  add(material, geometry, matrix) {
    if (matrix) geometry.applyMatrix4(matrix);
    let bucket = this.buckets.get(material);
    if (!bucket) {
      bucket = [];
      this.buckets.set(material, bucket);
    }
    bucket.push(geometry);
  }

  box(material, w, h, d, x, y, z, ry, uvScaleU, uvScaleV) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (uvScaleU || uvScaleV) scaleUVs(geo, uvScaleU || 1, uvScaleV || 1);
    const m = new THREE.Matrix4();
    if (ry) m.makeRotationY(ry);
    m.setPosition(x, y, z);
    this.add(material, geo, m);
  }

  flush(castShadow, receiveShadow) {
    for (const [material, geometries] of this.buckets) {
      const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
      mesh.castShadow = !!castShadow;
      mesh.receiveShadow = !!receiveShadow;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
    }
    this.buckets.clear();
  }
}

// Scale a geometry's UVs so a repeating texture (windows, road dashes)
// tiles by world size instead of stretching across big faces.
export function scaleUVs(geometry, su, sv) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  return geometry;
}

export function translationMatrix(x, y, z, ry, rx, rz) {
  const m = new THREE.Matrix4();
  const e = new THREE.Euler(rx || 0, ry || 0, rz || 0);
  m.makeRotationFromEuler(e);
  m.setPosition(x, y, z);
  return m;
}
