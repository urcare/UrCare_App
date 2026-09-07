// Computes the 3D marker positions used by src/components/BodyMapScreen.tsx
// for its health hotspots — by raycasting against the real body meshes at
// public/models/male.glb / female.glb, so each dot sits exactly on the
// mesh surface instead of a hand-guessed coordinate.
//
// Run with: node scripts/generate-body-hotspots.mjs public/models/male.glb public/models/female.glb out.json
// Then copy the resulting points into BODY_HOTSPOTS in BodyMapScreen.tsx.
// Re-run this only if the .glb model assets themselves are replaced —
// the REGION_DEFS below (which height/side each region targets) are the
// part you'd tune first.
import fs from 'fs';
import * as THREE from 'three';

function getGlb(file) {
  const buf = fs.readFileSync(file);
  let offset = 12;
  let json = null;
  let binChunk = null;
  while (offset < buf.length) {
    const chunkLength = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunkData.toString('utf8'));
    if (chunkType === 0x004e4942) binChunk = chunkData;
    offset += 8 + chunkLength;
  }
  return { json, binChunk };
}

function readAccessor(json, binChunk, idx) {
  const acc = json.accessors[idx];
  const bv = json.bufferViews[acc.bufferView];
  const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const typeCounts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const n = typeCounts[acc.type];
  let arr;
  if (acc.componentType === 5126) arr = new Float32Array(binChunk.buffer, binChunk.byteOffset + byteOffset, acc.count * n);
  else if (acc.componentType === 5125) arr = new Uint32Array(binChunk.buffer, binChunk.byteOffset + byteOffset, acc.count * n);
  return { arr, count: acc.count, n };
}

function loadGeometry(file) {
  const { json, binChunk } = getGlb(file);
  const prim = json.meshes[0].primitives[0];
  const pos = readAccessor(json, binChunk, prim.attributes.POSITION);
  const norm = readAccessor(json, binChunk, prim.attributes.NORMAL);
  const idx = readAccessor(json, binChunk, prim.indices);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos.arr.slice(), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(norm.arr.slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(idx.arr.slice(), 1));
  return geometry;
}

function getBBox(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox;
}

// region defs: fracY (0 bottom..1 top), fracX (-1..1 relative to half-width, 0=center),
// view: 'front' (ray from +Z toward -Z) or 'back' (ray from -Z toward +Z), mirror: boolean.
const REGION_DEFS = [
  { id: 'head', label: 'Head', fracY: 0.955, fracX: 0, view: 'front' },
  { id: 'eyes', label: 'Eyes', fracY: 0.92, fracX: 0, view: 'front' },
  { id: 'neck', label: 'Neck', fracY: 0.865, fracX: 0, view: 'front' },
  { id: 'shoulders', label: 'Shoulders', fracY: 0.79, view: 'front', mirror: true, scan: true },
  { id: 'chest', label: 'Chest', fracY: 0.735, fracX: 0, view: 'front' },
  { id: 'arms', label: 'Arms', fracY: 0.62, view: 'front', mirror: true, scan: true },
  { id: 'stomach', label: 'Stomach & Abdomen', fracY: 0.58, fracX: 0, view: 'front' },
  { id: 'hips', label: 'Hips', fracY: 0.40, fracX: 0, view: 'front' },
  { id: 'lowerBack', label: 'Lower Back', fracY: 0.56, fracX: 0, view: 'back' },
  { id: 'knees', label: 'Knees', fracY: 0.29, view: 'front', mirror: true, scan: true },
  { id: 'legs', label: 'Legs', fracY: 0.18, view: 'front', mirror: true, scan: true },
  { id: 'ankles', label: 'Ankles', fracY: 0.045, view: 'back', mirror: true, scan: true },
  { id: 'feet', label: 'Feet', fracY: 0.02, view: 'front', mirror: true, scan: true },
];

function computeHotspots(file) {
  const geometry = loadGeometry(file);
  const bbox = getBBox(geometry);
  const w = bbox.max.x - bbox.min.x;
  const h = bbox.max.y - bbox.min.y;
  const d = bbox.max.z - bbox.min.z;

  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const raycaster = new THREE.Raycaster();

  const results = {};

  function cast(fracX, fracY, view) {
    const x = fracX * (w / 2);
    const y = bbox.min.y + fracY * h;
    const zFar = view === 'front' ? bbox.max.z + 1 : bbox.min.z - 1;
    const dir = view === 'front' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
    const origin = new THREE.Vector3(x, y, zFar);
    raycaster.set(origin, dir);
    raycaster.far = 3;
    const hits = raycaster.intersectObject(mesh, false);
    if (hits.length === 0) return null;
    const hit = hits[0];
    // push the marker slightly outside the surface along the face normal
    const n = hit.face ? hit.face.normal.clone() : dir.clone().negate();
    const p = hit.point.clone().add(n.multiplyScalar(0.008));
    return [p.x, p.y, p.z];
  }

  // Scans from just outside the model inward until it finds the body's
  // outer silhouette at this height — robust for limbs/extremities where a
  // fixed guessed offset can miss through the gap between an arm and torso.
  function scanOutsideIn(sign, fracY, view) {
    for (let mag = 1.35; mag >= 0.02; mag -= 0.015) {
      const p = cast(sign * mag, fracY, view);
      if (p) return p;
    }
    return null;
  }

  // A straight fracX=0 cast can slip through the gap between the thighs on
  // some body proportions — nudge outward in small steps until it lands.
  function castNearCenter(fracY, view) {
    for (const fracX of [0, 0.06, -0.06, 0.12, -0.12, 0.18, -0.18]) {
      const p = cast(fracX, fracY, view);
      if (p) return p;
    }
    return null;
  }

  REGION_DEFS.forEach((r) => {
    if (r.mirror && r.scan) {
      const right = scanOutsideIn(1, r.fracY, r.view);
      const left = scanOutsideIn(-1, r.fracY, r.view);
      results[r.id] = { label: r.label, points: [right, left].filter(Boolean) };
    } else if (r.mirror) {
      const right = cast(r.fracX, r.fracY, r.view);
      const left = cast(-r.fracX, r.fracY, r.view);
      results[r.id] = { label: r.label, points: [right, left].filter(Boolean) };
    } else if (r.fracX === 0) {
      const p = castNearCenter(r.fracY, r.view);
      results[r.id] = { label: r.label, points: p ? [p] : [] };
    } else {
      const p = cast(r.fracX, r.fracY, r.view);
      results[r.id] = { label: r.label, points: p ? [p] : [] };
    }
  });

  return { bbox: { min: bbox.min.toArray(), max: bbox.max.toArray() }, results };
}

const out = {};
out.male = computeHotspots(process.argv[2]);
out.female = computeHotspots(process.argv[3]);
fs.writeFileSync(process.argv[4], JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
