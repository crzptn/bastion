/**
 * Per-def enemy mesh components.
 *
 * Shape vocabulary (open for future enemy types)
 * -----------------------------------------------
 * - goblin: body (capsule) + head (sphere) grouped under <group>
 * - Future types could use: BoxGeometry (armoured golem),
 *   TorusGeometry (flying ring wraith), etc.
 *
 * Performance (LEARNINGS #35/#46)
 * --------------------------------
 * All THREE.BufferGeometry and THREE.MeshStandardMaterial instances are
 * allocated once at module scope and shared across every instance of each
 * component. No new THREE.* calls inside render functions.
 *
 * Colors
 * ------
 * All color tokens come from THEME — no hardcoded hex literals in this file.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { THEME } from '../theme';

// ---------------------------------------------------------------------------
// Shared geometry / material — module scope, never reallocated on render
// ---------------------------------------------------------------------------

// goblin body: capsule (radius, length, capSegments, radialSegments)
const goblinBodyGeometry = new THREE.CapsuleGeometry(0.18, 0.32, 4, 8);
// goblin head: sphere
const goblinHeadGeometry = new THREE.SphereGeometry(0.18, 8, 8);
const goblinMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.enemies.goblin) });

// placeholder: magenta cube for unknown defIds
const placeholderEnemyGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const placeholderEnemyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.placeholder) });

// ---------------------------------------------------------------------------
// Small string hash — deterministic, never changes for same id.
// Used to derive a per-instance phase offset so neighbouring enemies bob
// out of phase with each other.
// ---------------------------------------------------------------------------
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  return h;
}

// Vertical body centre (half of capsule length + radius)
const BODY_CENTER_Y = 0.16 + 0.18; // 0.34
// Head centre sits above body top: body top = BODY_CENTER_Y + capsule_half = 0.34+0.16+0.18
const HEAD_CENTER_Y = BODY_CENTER_Y + 0.16 + 0.18 + 0.18; // 0.86

// Walk-bob amplitude (world units) and frequency (radians/second)
const BOB_AMPLITUDE = 0.035;
const BOB_FREQUENCY = 5.5; // ~0.88 Hz

// ---------------------------------------------------------------------------
// Prop type shared by all enemy mesh components
// ---------------------------------------------------------------------------
export type EnemyMeshProps = {
  position: [number, number, number];
  heading?: number;   // Y-axis rotation in radians
  id?: string;        // used to derive per-instance bob phase
};

// ---------------------------------------------------------------------------
// Goblin — body (capsule) + head (sphere) with walk-bob and facing direction
// ---------------------------------------------------------------------------
const GoblinMesh: React.FC<EnemyMeshProps> = ({ position, heading, id }) => {
  const groupRef = useRef<THREE.Group>(null);
  const phase = id !== undefined ? hashId(id) * 0.0001 : 0;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.position.y = position[1] + Math.sin(t * BOB_FREQUENCY + phase) * BOB_AMPLITUDE;
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, heading ?? 0, 0]}
    >
      <mesh geometry={goblinBodyGeometry} material={goblinMaterial} position={[0, BODY_CENTER_Y, 0]} />
      <mesh geometry={goblinHeadGeometry} material={goblinMaterial} position={[0, HEAD_CENTER_Y, 0]} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Placeholder — magenta cube for unknown defIds
// ---------------------------------------------------------------------------
export const PLACEHOLDER_ENEMY_MESH: React.FC<EnemyMeshProps> = ({ position }) => (
  <mesh geometry={placeholderEnemyGeometry} material={placeholderEnemyMaterial} position={position} />
);

// ---------------------------------------------------------------------------
// Registry — maps every id in ENEMY_DEFS to its component
// ---------------------------------------------------------------------------
export const ENEMY_MESHES: Record<string, React.FC<EnemyMeshProps>> = {
  goblin: GoblinMesh,
};
