import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const BURST_MS = 250;
const PARTICLE_COUNT = 10;
const BURST_RADIUS = 0.5;

const particleGeometry = new THREE.SphereGeometry(0.06, 6, 6);
const particleMaterialTemplate = new THREE.MeshBasicMaterial({
  color: new THREE.Color(1.5, 0.8, 0.3),
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

function makeOffsets(): THREE.Vector3[] {
  const offsets: THREE.Vector3[] = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const theta = (2 * Math.PI * i) / goldenRatio;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);
    offsets.push(
      new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      ),
    );
  }
  return offsets;
}

const OFFSETS = makeOffsets();

type HitBurstProps = {
  position: [number, number, number];
  lastHitAt?: number;
};

export function HitBurst({ position, lastHitAt }: HitBurstProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>(
    Array.from({ length: PARTICLE_COUNT }, () => null),
  );
  const lastHitAtRef = useRef(lastHitAt);
  lastHitAtRef.current = lastHitAt;

  const materials = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, () => particleMaterialTemplate.clone()),
    [],
  );

  useEffect(() => () => { materials.forEach((m) => m.dispose()); }, [materials]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const lha = lastHitAtRef.current;
    if (lha === undefined) {
      group.visible = false;
      return;
    }
    const age = performance.now() - lha;
    if (age >= BURST_MS) {
      group.visible = false;
      return;
    }
    group.visible = true;
    const t = age / BURST_MS;
    const opacity = 1 - t;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const mesh = meshRefs.current[i];
      const mat = materials[i];
      if (!mesh) continue;
      const offset = OFFSETS[i];
      mesh.position.set(
        offset.x * t * BURST_RADIUS,
        offset.y * t * BURST_RADIUS,
        offset.z * t * BURST_RADIUS,
      );
      mat.opacity = opacity;
    }
  });

  return (
    <group ref={groupRef} position={position} visible={false}>
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          geometry={particleGeometry}
          material={materials[i]}
        />
      ))}
    </group>
  );
}
