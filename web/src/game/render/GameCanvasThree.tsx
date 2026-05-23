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
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { EnemyInstance, Grid, Path, TowerInstance } from '../types';
import { enemyPosition } from '../sim/enemies';
import { THEME } from './theme';
import { ENEMY_MESHES, PLACEHOLDER_ENEMY_MESH } from './meshes/enemies';
import { PLACEHOLDER_TOWER_MESH, TOWER_MESHES } from './meshes/towers';

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

const THEME_BG = hexToThreeColor(THEME.bg);
const THEME_PATH = hexToThreeColor(THEME.path);
const THEME_BUILDABLE = hexToThreeColor(THEME.buildable);
const THEME_HOVER_PARSED = parseRgba(THEME.hover);

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
// CameraRig — adjusts OrthographicCamera zoom to fit the grid in the container
// ---------------------------------------------------------------------------
interface CameraRigProps {
  cols: number;
  rows: number;
}

function CameraRig({ cols, rows }: CameraRigProps) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const zoom = Math.min(size.width / cols, size.height / rows);
    camera.zoom = zoom;
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
      let color: THREE.Color;
      if (isPath) {
        color = THEME_PATH;
      } else if (cell.buildable) {
        color = THEME_BUILDABLE;
      } else {
        color = THEME_BG;
      }
      const [wx, wy, wz] = gridToWorld(cell.x, cell.y);
      return { key: `${cell.x},${cell.y}`, x: wx, y: wy, z: wz, color, buildable: cell.buildable };
    });
  }, [grid.cells, pathCellSet, gridToWorld]);

  // Ground picker event handlers
  const [pickerWx, pickerWz] = useMemo((): [number, number] => {
    // Center of grid in world space
    return [0, 0];
  }, []);

  return (
    <>
      {/* Camera rig adjusts zoom on container resize */}
      <CameraRig cols={cols} rows={rows} />

      {/* Orthographic camera looking straight down from y=20 */}
      <OrthographicCamera
        makeDefault
        position={[0, 20, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        near={0.1}
        far={100}
      />

      {/* Minimal lighting for MeshStandardMaterial on per-def meshes (#43).
           Lighting will be refined in issue #44. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />

      {/* Tiles */}
      {tileMeshes.map(({ key, x, y, z, color }) => (
        <mesh
          key={key}
          geometry={tileGeometry}
          position={[x, y, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial color={color} />
        </mesh>
      ))}

      {/* Towers — per-def mesh; tower mesh "front" faces -z (top-down camera reference).
           Falls back to PLACEHOLDER_TOWER_MESH for unknown defIds (magenta, no throw). */}
      {towers.map((tower) => {
        const [wx, , wz] = gridToWorld(tower.x, tower.y);
        const TowerMesh = TOWER_MESHES[tower.defId] ?? PLACEHOLDER_TOWER_MESH;
        return <TowerMesh key={tower.id} position={[wx, 0.3, wz]} />;
      })}

      {/* Enemies — per-def mesh via ENEMY_MESHES registry.
           Falls back to PLACEHOLDER_ENEMY_MESH for unknown defIds (magenta, no throw). */}
      {enemies.map((enemy) => {
        const pos = enemyPosition(enemy, path);
        const [wx, , wz] = gridToWorld(pos.x, pos.y);
        const EnemyMesh = ENEMY_MESHES[enemy.defId] ?? PLACEHOLDER_ENEMY_MESH;
        return <EnemyMesh key={enemy.id} position={[wx, 0.3, wz]} />;
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

      {/* Invisible ground picker — handles pointer events for hover + click */}
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
      <Canvas dpr={[1, 2]} flat>
        <Scene map={map} towers={towers} enemies={enemies} onCellClick={onCellClick} />
      </Canvas>
    </div>
  );
}
