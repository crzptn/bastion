/**
 * Per-def tower mesh components.
 *
 * Convention
 * ----------
 * Each tower's "front" faces -z in local space, matching the top-down camera
 * orientation. A future targeting visual can use this as a reference direction.
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

// cannon: squat cylinder base + box turret
const cannonBaseGeometry = new THREE.CylinderGeometry(0.42, 0.45, 0.35, 12);
const cannonTurretGeometry = new THREE.BoxGeometry(0.38, 0.28, 0.38);
const cannonBaseMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.towers.cannon) });
const cannonTurretMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.towers.cannon).multiplyScalar(0.7) });

// archer: cylinder base + cone roof
const archerBaseGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10);
const archerRoofGeometry = new THREE.ConeGeometry(0.35, 0.4, 10);
const archerBaseMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.towers.archer) });
const archerRoofMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.towers.archer).multiplyScalar(0.75) });

// placeholder: magenta box for unknown defIds
const placeholderTowerGeometry = new THREE.BoxGeometry(0.9, 0.6, 0.9);
const placeholderTowerMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(THEME.placeholder) });

// ---------------------------------------------------------------------------
// Prop type shared by all tower mesh components
// ---------------------------------------------------------------------------
export type TowerMeshProps = {
  position: [number, number, number];
};

// ---------------------------------------------------------------------------
// Cannon — wide squat cylinder base + box turret on top
// ---------------------------------------------------------------------------
const CannonMesh: React.FC<TowerMeshProps> = ({ position }) => (
  <group position={position}>
    {/* Base cylinder, centred at y=0 relative to group */}
    <mesh geometry={cannonBaseGeometry} material={cannonBaseMaterial} position={[0, 0.175, 0]} />
    {/* Turret box on top of base */}
    <mesh geometry={cannonTurretGeometry} material={cannonTurretMaterial} position={[0, 0.49, 0]} />
  </group>
);

// ---------------------------------------------------------------------------
// Archer — cylinder tower body + cone roof
// ---------------------------------------------------------------------------
const ArcherMesh: React.FC<TowerMeshProps> = ({ position }) => (
  <group position={position}>
    {/* Tower body */}
    <mesh geometry={archerBaseGeometry} material={archerBaseMaterial} position={[0, 0.25, 0]} />
    {/* Cone roof sitting on top */}
    <mesh geometry={archerRoofGeometry} material={archerRoofMaterial} position={[0, 0.7, 0]} />
  </group>
);

// ---------------------------------------------------------------------------
// Placeholder — magenta box rendered for any unknown defId
// ---------------------------------------------------------------------------
export const PLACEHOLDER_TOWER_MESH: React.FC<TowerMeshProps> = ({ position }) => (
  <mesh geometry={placeholderTowerGeometry} material={placeholderTowerMaterial} position={position} />
);

// ---------------------------------------------------------------------------
// Registry — maps every id in TOWER_DEFS to its component
// ---------------------------------------------------------------------------
export const TOWER_MESHES: Record<string, React.FC<TowerMeshProps>> = {
  cannon: CannonMesh,
  archer: ArcherMesh,
};
