/**
 * GameCanvasThree — react-three-fiber renderer for the Bastion game map.
 *
 * Coordinate convention
 * ---------------------
 * The simulation uses a grid where (x, y) = (col, row) with y growing downward.
 * Three.js uses a right-handed coordinate system with y-up.
 * We map:   sim.x  → world.x  (left/right)
 *           sim.y  → world.z  (into/out-of screen, since camera looks down)
 *           world.y is always 0 for tiles (ground plane) or 0.3 for elevated meshes.
 *
 * gridToWorld(col, row) => [col - cols/2 + 0.5,  0,  row - rows/2 + 0.5]
 * The inverse (worldToCell) is used in the pointer handler.
 *
 * Performance note
 * ----------------
 * Enemy and tower rendering is driven by React-state updates (same as Canvas2D parity).
 * A future perf upgrade would move enemy positions to useFrame with a ref-based store
 * to avoid per-frame React reconciler overhead (#43+).
 *
 * Camera note
 * -----------
 * We use a tilted PerspectiveCamera (fov=45) so the 3D meshes read as 3D.
 * CameraRig computes the camera distance to fit the entire grid in the viewport,
 * using fitDistance(). OrbitControls provides drag-rotate + scroll-zoom with
 * pan disabled and polar/distance clamped.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { EnemyInstance, Grid, Path, TowerInstance } from '../types';
import { enemyPosition } from '../sim/enemies';
import { THEME } from './theme';
import { ENEMY_MESHES, PLACEHOLDER_ENEMY_MESH } from './meshes/enemies';
import { PLACEHOLDER_TOWER_MESH, TOWER_MESHES } from './meshes/towers';
import { HitBurst } from './meshes/hitBurst';

// ---------------------------------------------------------------------------
// Shared geometry / material instances (module-level to avoid re-allocation)
// Per-def tower and enemy geometries/materials live in meshes/towers.ts and
// meshes/enemies.ts respectively.
// ---------------------------------------------------------------------------
const tileGeometry = new THREE.PlaneGeometry(1, 1);
const hoverGeometry = new THREE.PlaneGeometry(1, 1);

// ---------------------------------------------------------------------------
// Color helpers — parse THEME hex/rgba strings into THREE.Color
// ---------------------------------------------------------------------------
function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/** Extract r,g,b,a from "rgba(r, g, b, a)" */
function parseRgba(rgba: string): { color: THREE.Color; opacity: number } {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return { color: new THREE.Color(0xffffff), opacity: 1 };
  const r = parseInt(m[1]) / 255;
  const g = parseInt(m[2]) / 255;
  const b = parseInt(m[3]) / 255;
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  return { color: new THREE.Color(r, g, b), opacity: a };
}

const THEME_HOVER_PARSED = parseRgba(THEME.hover);

// ---------------------------------------------------------------------------
// Tile materials — module-scope MeshStandardMaterial instances, one per tile type.
// Using MeshStandardMaterial so tiles receive lighting and shadow.
// ---------------------------------------------------------------------------
const TILE_PATH_MATERIAL = new THREE.MeshStandardMaterial({
  color: hexToThreeColor(THEME.path),
});
const TILE_BUILDABLE_MATERIAL = new THREE.MeshStandardMaterial({
  color: hexToThreeColor(THEME.buildable),
});
const TILE_BG_MATERIAL = new THREE.MeshStandardMaterial({
  color: hexToThreeColor(THEME.bg),
});

// ---------------------------------------------------------------------------
// fitDistance — pure helper (exported for unit testing).
//
// Computes the camera distance from the grid centre so that the entire grid
// (cols × rows) fills the viewport without clipping, accounting for aspect.
//
//   vertical visible half = d * tan(fov/2)
//   horizontal visible half = d * tan(fov/2) * aspect
//
// We need both to cover the respective half-extents:
//   d >= (rows/2)  / tan(fov/2)          — vertical constraint
//   d >= (cols/2)  / (tan(fov/2) * aspect) — horizontal constraint
//
// Add 10 % padding so tiles are not flush against the viewport edge.
// ---------------------------------------------------------------------------
export function fitDistance(cols: number, rows: number, fovDeg: number, aspect: number): number {
  const halfFov = (fovDeg / 2) * (Math.PI / 180);
  const tanHalfFov = Math.tan(halfFov);
  const verticalDist = rows / 2 / tanHalfFov;
  const horizontalDist = cols / 2 / (tanHalfFov * aspect);
  return Math.max(verticalDist, horizontalDist) * 1.1;
}

// ---------------------------------------------------------------------------
// Props — identical shape to the deleted GameCanvas
// ---------------------------------------------------------------------------
type Props = {
  map: { grid: Grid; path: Path };
  towers?: TowerInstance[];
  enemies?: EnemyInstance[];
  onCellClick?: (pos: { x: number; y: number }) => void;
};

// ---------------------------------------------------------------------------
// buildPathCellSet — local copy (not promoted to shared module per #42 scope)
// ---------------------------------------------------------------------------
function buildPathCellSet(path: Path): Set<string> {
  const set = new Set<string>();
  const { waypoints } = path;
  for (let w = 0; w < waypoints.length - 1; w++) {
    const from = waypoints[w];
    const to = waypoints[w + 1];
    if (from.x === to.x) {
      const minY = Math.min(from.y, to.y);
      const maxY = Math.max(from.y, to.y);
      for (let y = minY; y <= maxY; y++) {
        set.add(`${from.x},${y}`);
      }
    } else {
      const minX = Math.min(from.x, to.x);
      const maxX = Math.max(from.x, to.x);
      for (let x = minX; x <= maxX; x++) {
        set.add(`${x},${from.y}`);
      }
    }
  }
  return set;
}

// ---------------------------------------------------------------------------
// gridToWorld / worldToCell helpers
// ---------------------------------------------------------------------------
function makeHelpers(cols: number, rows: number) {
  function gridToWorld(col: number, row: number): [number, number, number] {
    return [col - cols / 2 + 0.5, 0, row - rows / 2 + 0.5];
  }

  function worldToCell(wx: number, wz: number): { x: number; y: number } | null {
    const x = Math.floor(wx + cols / 2);
    const y = Math.floor(wz + rows / 2);
    if (x < 0 || x >= cols || y < 0 || y >= rows) return null;
    return { x, y };
  }

  return { gridToWorld, worldToCell };
}

// ---------------------------------------------------------------------------
// CameraRig — updates PerspectiveCamera position on container/grid size change.
//
// The camera is positioned at a tilted angle looking at the grid centre [0,0,0].
// Default tilt offset: x=0, y=1, z=0.7 (normalized), so roughly 55 ° above
// the ground — within the clamped polar range (π/6 … π/3).
// On each resize or grid change we recompute the fit distance and scale the
// offset vector accordingly.
// ---------------------------------------------------------------------------
interface CameraRigProps {
  cols: number;
  rows: number;
}

// Default look direction offset (unnormalized) — gives the initial tilt.
// y and z together produce the tilted-but-not-straight-down angle.
const DEFAULT_OFFSET = new THREE.Vector3(0, 1.4, 1.0).normalize();
const DEFAULT_FOV = 45;

function CameraRig({ cols, rows }: CameraRigProps) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / size.height;
    const d = fitDistance(cols, rows, DEFAULT_FOV, aspect);
    camera.position.copy(DEFAULT_OFFSET.clone().multiplyScalar(d));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size, cols, rows]);

  return null;
}

// ---------------------------------------------------------------------------
// Inner scene — rendered inside <Canvas>
// ---------------------------------------------------------------------------
interface SceneProps {
  map: { grid: Grid; path: Path };
  towers: TowerInstance[];
  enemies: EnemyInstance[];
  onCellClick?: (pos: { x: number; y: number }) => void;
}

function Scene({ map, towers, enemies, onCellClick }: SceneProps) {
  const { grid, path } = map;
  const { cols, rows } = grid;
  const [hovered, setHovered] = useState<{ x: number; y: number } | null>(null);

  const pathCellSet = useMemo(() => buildPathCellSet(path), [path]);
  const { gridToWorld, worldToCell } = useMemo(() => makeHelpers(cols, rows), [cols, rows]);

  // Pre-build per-cell tile data to avoid repeated work in render
  const tileMeshes = useMemo(() => {
    return grid.cells.map((cell) => {
      const isPath = pathCellSet.has(`${cell.x},${cell.y}`);
      let material: THREE.MeshStandardMaterial;
      if (isPath) {
        material = TILE_PATH_MATERIAL;
      } else if (cell.buildable) {
        material = TILE_BUILDABLE_MATERIAL;
      } else {
        material = TILE_BG_MATERIAL;
      }
      const [wx, wy, wz] = gridToWorld(cell.x, cell.y);
      return { key: `${cell.x},${cell.y}`, x: wx, y: wy, z: wz, material, buildable: cell.buildable };
    });
  }, [grid.cells, pathCellSet, gridToWorld]);

  // Ground picker event handlers
  const [pickerWx, pickerWz] = useMemo((): [number, number] => {
    // Center of grid in world space
    return [0, 0];
  }, []);

  return (
    <>
      {/* Camera rig adjusts position on container resize */}
      <CameraRig cols={cols} rows={rows} />

      {/* Perspective camera tilted to show 3D meshes — initial position set by CameraRig */}
      <PerspectiveCamera
        makeDefault
        fov={DEFAULT_FOV}
        near={0.1}
        far={100}
        position={[0, DEFAULT_OFFSET.y * 14, DEFAULT_OFFSET.z * 14]}
      />

      {/* OrbitControls — drag rotates, scroll zooms; pan disabled; polar/distance clamped */}
      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        enableZoom={true}
        enableDamping={true}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 3}
        minDistance={5}
        maxDistance={40}
      />

      {/* Lighting — issue #44.
           ambientLight provides base fill; directionalLight casts shadows onto ground. */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.9}
        castShadow
        shadow-mapSize={[1024, 1024] as [number, number]}
        shadow-camera-left={-cols / 2}
        shadow-camera-right={cols / 2}
        shadow-camera-top={rows / 2}
        shadow-camera-bottom={-rows / 2}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
      />

      {/* Tiles — MeshStandardMaterial per type (path/buildable/void), receiveShadow enabled */}
      {tileMeshes.map(({ key, x, y, z, material }) => (
        <mesh
          key={key}
          geometry={tileGeometry}
          material={material}
          position={[x, y, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        />
      ))}

      {/* Towers — per-def mesh; tower mesh "front" faces -z (top-down camera reference).
           Falls back to PLACEHOLDER_TOWER_MESH for unknown defIds (magenta, no throw). */}
      {towers.map((tower) => {
        const [wx, , wz] = gridToWorld(tower.x, tower.y);
        const TowerMesh = TOWER_MESHES[tower.defId] ?? PLACEHOLDER_TOWER_MESH;
        return <TowerMesh key={tower.id} position={[wx, 0.3, wz]} lastFiredAt={tower.lastFiredAt} />;
      })}

      {/* Enemies — per-def mesh via ENEMY_MESHES registry.
           Falls back to PLACEHOLDER_ENEMY_MESH for unknown defIds (magenta, no throw). */}
      {enemies.map((enemy) => {
        const pos = enemyPosition(enemy, path);
        const [wx, , wz] = gridToWorld(pos.x, pos.y);
        const EnemyMesh = ENEMY_MESHES[enemy.defId] ?? PLACEHOLDER_ENEMY_MESH;
        return (
          <Fragment key={enemy.id}>
            <EnemyMesh position={[wx, 0.3, wz]} />
            <HitBurst lastHitAt={enemy.lastHitAt} position={[wx, 0.3, wz]} />
          </Fragment>
        );
      })}

      {/* Hover highlight — only on buildable cells */}
      {hovered &&
        (() => {
          const cell = grid.cells.find((c) => c.x === hovered.x && c.y === hovered.y);
          if (!cell?.buildable) return null;
          const [wx, , wz] = gridToWorld(hovered.x, hovered.y);
          return (
            <mesh
              key="hover"
              geometry={hoverGeometry}
              position={[wx, 0.01, wz]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <meshBasicMaterial
                color={THEME_HOVER_PARSED.color}
                transparent
                opacity={THEME_HOVER_PARSED.opacity}
                depthWrite={false}
              />
            </mesh>
          );
        })()}

      {/* Invisible ground picker — handles pointer events for hover + click.
           Picker math is camera-agnostic: r3f raycasts against this plane and
           returns e.point in world space, which worldToCell converts to grid coords. */}
      <mesh
        position={[pickerWx, 0, pickerWz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={(e) => {
          e.stopPropagation();
          const cell = worldToCell(e.point.x, e.point.z);
          setHovered(cell);
        }}
        onPointerOut={() => {
          setHovered(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          const cell = worldToCell(e.point.x, e.point.z);
          if (cell) onCellClick?.(cell);
        }}
      >
        <planeGeometry args={[cols, rows]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={0.6} mipmapBlur />
      </EffectComposer>
    </>
  );
}

// ---------------------------------------------------------------------------
// GameCanvasThree — exported component, same Props as the deleted GameCanvas
// ---------------------------------------------------------------------------
export function GameCanvasThree({ map, towers = [], enemies = [], onCellClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas dpr={[1, 2]} flat shadows>
        <Scene map={map} towers={towers} enemies={enemies} onCellClick={onCellClick} />
      </Canvas>
    </div>
  );
}
