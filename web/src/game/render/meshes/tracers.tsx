/**
 * TracerField — visible per-shot tracers flying from tower to target.
 *
 * Strategy 1 (renderer-only): The sim records `lastFiredTargetId` on TowerInstance.
 * GameCanvasThree drives tracer emission via a `tracersRef` ring buffer capped at
 * MAX_TRACERS (200). TracerField reads the buffer each frame (useFrame) and interpolates
 * a pre-allocated pool of MAX_TRACERS <mesh> elements — no per-frame allocations.
 *
 * Damage stays instant in tickCombat. The tracer is purely decorative.
 *
 * Performance: SphereGeometry and MeshBasicMaterial are allocated once at module
 * scope. The mesh pool is sized to MAX_TRACERS. No `new THREE.*` inside useFrame.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

/** Maximum duration of a single tracer in milliseconds. Must be <= 150. */
export const TRACER_MS = 120;

/** Maximum number of concurrent tracer slots. Older tracers are dropped on overflow. */
export const MAX_TRACERS = 200;

// ---------------------------------------------------------------------------
// Module-scope geometry / material (allocated once — AC3)
// Low-poly sphere: 6 width segments, 4 height segments.
// ---------------------------------------------------------------------------
const tracerGeometry = new THREE.SphereGeometry(0.08, 6, 4);

const tracerMaterial = new THREE.MeshBasicMaterial({
  color: new THREE.Color(2.5, 1.6, 0.2), // over-bright yellow for bloom pick-up
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
});

// ---------------------------------------------------------------------------
// TracerSlot type — public so GameCanvasThree can build slots
// ---------------------------------------------------------------------------
export type TracerSlot = {
  id: string;
  originX: number;
  originY: number;
  originZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  startMs: number;
};

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit tests (AC2)
// ---------------------------------------------------------------------------

/**
 * Linear interpolation of a 3-D position between `origin` and `target`.
 * `t` is clamped to [0, 1].
 */
export function lerpTracerPosition(
  origin: [number, number, number],
  target: [number, number, number],
  t: number,
): [number, number, number] {
  const tc = Math.max(0, Math.min(1, t));
  return [
    origin[0] + (target[0] - origin[0]) * tc,
    origin[1] + (target[1] - origin[1]) * tc,
    origin[2] + (target[2] - origin[2]) * tc,
  ];
}

/**
 * Push a new TracerSlot onto the ring buffer.
 * When the buffer is at MAX_TRACERS capacity, the oldest slot (index 0) is dropped.
 * Exported for unit tests (AC4).
 */
export function pushTracer(buf: TracerSlot[], slot: TracerSlot): void {
  if (buf.length >= MAX_TRACERS) {
    buf.shift(); // drop oldest — O(n) but MAX_TRACERS=200 is fine
  }
  buf.push(slot);
}

// ---------------------------------------------------------------------------
// TracerFieldProps
// ---------------------------------------------------------------------------
export type TracerFieldProps = {
  tracersRef: React.RefObject<TracerSlot[]>;
};

// ---------------------------------------------------------------------------
// TracerField component
// ---------------------------------------------------------------------------
export const TracerField = ({ tracersRef }: TracerFieldProps) => {
  // Ref to the pre-allocated mesh pool (MAX_TRACERS meshes).
  const meshRefs = useRef<(THREE.Mesh | null)[]>(
    Array.from({ length: MAX_TRACERS }, () => null),
  );

  useFrame(() => {
    const slots = tracersRef.current;
    if (!slots) return;

    const nowMs = performance.now();

    for (let i = 0; i < MAX_TRACERS; i++) {
      const mesh = meshRefs.current[i];
      if (!mesh) continue;

      const slot = slots[i];
      if (!slot) {
        mesh.visible = false;
        continue;
      }

      const elapsed = nowMs - slot.startMs;
      if (elapsed >= TRACER_MS || elapsed < 0) {
        mesh.visible = false;
        continue;
      }

      const t = elapsed / TRACER_MS;
      const pos = lerpTracerPosition(
        [slot.originX, slot.originY, slot.originZ],
        [slot.targetX, slot.targetY, slot.targetZ],
        t,
      );

      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.visible = true;

      // Fade out as t → 1
      (mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t * 0.6;
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_TRACERS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
          geometry={tracerGeometry}
          material={tracerMaterial}
          visible={false}
        />
      ))}
    </group>
  );
};
