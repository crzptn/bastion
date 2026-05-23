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

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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

const flashGeometry = new THREE.SphereGeometry(0.55, 8, 8);
const flashMaterialTemplate = new THREE.MeshBasicMaterial({
  color: new THREE.Color(2.0, 1.8, 0.8),
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const FLASH_MS = 150;

// ---------------------------------------------------------------------------
// Prop type shared by all tower mesh components
// ---------------------------------------------------------------------------
export type TowerMeshProps = {
  position: [number, number, number];
  lastFiredAt?: number;
};

// ---------------------------------------------------------------------------
// Cannon — wide squat cylinder base + box turret on top
// ---------------------------------------------------------------------------
const CannonMesh: React.FC<TowerMeshProps> = ({ position, lastFiredAt }) => {
  const mat = useMemo(() => flashMaterialTemplate.clone(), []);
  const meshRef = useRef<THREE.Mesh>(null);
  const lastFiredAtRef = useRef(lastFiredAt);
  lastFiredAtRef.current = lastFiredAt;

  useFrame(() => {
    const lfa = lastFiredAtRef.current;
    if (!meshRef.current) return;
    if (lfa === undefined) {
      meshRef.current.visible = false;
      return;
    }
    const t = (performance.now() - lfa) / FLASH_MS;
    if (t >= 1) {
      meshRef.current.visible = false;
    } else {
      meshRef.current.visible = true;
      mat.opacity = 1 - t;
    }
  });

  return (
    <group position={position}>
      <mesh geometry={cannonBaseGeometry} material={cannonBaseMaterial} position={[0, 0.175, 0]} castShadow />
      <mesh geometry={cannonTurretGeometry} material={cannonTurretMaterial} position={[0, 0.49, 0]} castShadow />
      <mesh ref={meshRef} geometry={flashGeometry} material={mat} position={[0, 0.35, 0]} visible={false} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Archer — cylinder tower body + cone roof
// ---------------------------------------------------------------------------
const ArcherMesh: React.FC<TowerMeshProps> = ({ position, lastFiredAt }) => {
  const mat = useMemo(() => flashMaterialTemplate.clone(), []);
  const meshRef = useRef<THREE.Mesh>(null);
  const lastFiredAtRef = useRef(lastFiredAt);
  lastFiredAtRef.current = lastFiredAt;

  useFrame(() => {
    const lfa = lastFiredAtRef.current;
    if (!meshRef.current) return;
    if (lfa === undefined) {
      meshRef.current.visible = false;
      return;
    }
    const t = (performance.now() - lfa) / FLASH_MS;
    if (t >= 1) {
      meshRef.current.visible = false;
    } else {
      meshRef.current.visible = true;
      mat.opacity = 1 - t;
    }
  });

  return (
    <group position={position}>
      <mesh geometry={archerBaseGeometry} material={archerBaseMaterial} position={[0, 0.25, 0]} castShadow />
      <mesh geometry={archerRoofGeometry} material={archerRoofMaterial} position={[0, 0.7, 0]} castShadow />
      <mesh ref={meshRef} geometry={flashGeometry} material={mat} position={[0, 0.45, 0]} visible={false} />
    </group>
  );
};

// ---------------------------------------------------------------------------
// Placeholder — magenta box rendered for any unknown defId
// ---------------------------------------------------------------------------
export const PLACEHOLDER_TOWER_MESH: React.FC<TowerMeshProps> = ({ position }) => (
  <mesh geometry={placeholderTowerGeometry} material={placeholderTowerMaterial} position={position} castShadow />
);

// ---------------------------------------------------------------------------
// Registry — maps every id in TOWER_DEFS to its component
// ---------------------------------------------------------------------------
export const TOWER_MESHES: Record<string, React.FC<TowerMeshProps>> = {
  cannon: CannonMesh,
  archer: ArcherMesh,
};
