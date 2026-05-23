import type { Cell, Grid, Path, TowerInstance } from './types';

export function cellAt(grid: Grid, x: number, y: number): Cell | undefined {
  if (x < 0 || x >= grid.cols || y < 0 || y >= grid.rows) {
    return undefined;
  }
  return grid.cells[y * grid.cols + x];
}

export function canPlaceTower(
  grid: Grid,
  towers: TowerInstance[],
  x: number,
  y: number,
): boolean {
  const cell = cellAt(grid, x, y);
  if (!cell || !cell.buildable) return false;
  return !towers.some((t) => t.x === x && t.y === y);
}

export function distanceAlongPath(path: Path, x: number, y: number): number {
  const waypoints = path.waypoints;
  let accumulatedDistance = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];

    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abLenSq = abx * abx + aby * aby;

    if (abLenSq === 0) continue;

    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / abLenSq));
    const closestX = a.x + t * abx;
    const closestY = a.y + t * aby;
    const distToSegment = Math.hypot(x - closestX, y - closestY);

    if (distToSegment < 0.5) {
      const segmentProgress = Math.hypot(closestX - a.x, closestY - a.y);
      return accumulatedDistance + segmentProgress;
    }

    accumulatedDistance += Math.hypot(abx, aby);
  }

  return accumulatedDistance;
}
