/**
 * Per-def enemy mesh components.
 *
 * Shape vocabulary (open for future enemy types)
 * -----------------------------------------------
 * - goblin: small sphere — fast, low-profile, readable at small scale
 * - Future types could use: CapsuleGeometry (tall humanoid), BoxGeometry
 *   (armoured golem), TorusGeometry (flying ring wraith), etc.
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

import React from 'react';
import * as THREE from 'three';
import { THEME } from '../theme';

// ---------------------------------------------------------------------------
// Shared geometry / material — module scope, never reallocated on render
// ---------------------------------------------------------------------------

// goblin: small sphere
const goblinGeometry = new THREE.SphereGeometry(0.28, 14, 14);
const goblinMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.enemies.goblin) });

// placeholder: magenta cube for unknown defIds
const placeholderEnemyGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const placeholderEnemyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.placeholder) });

// ---------------------------------------------------------------------------
// Prop type shared by all enemy mesh components
// ---------------------------------------------------------------------------
export type EnemyMeshProps = {
  position: [number, number, number];
};

// ---------------------------------------------------------------------------
// Goblin — small sphere with THEME.enemies.goblin color
// ---------------------------------------------------------------------------
const GoblinMesh: React.FC<EnemyMeshProps> = ({ position }) => (
  <mesh geometry={goblinGeometry} material={goblinMaterial} position={position} />
);

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
