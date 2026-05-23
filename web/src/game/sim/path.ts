import type { Path } from '../types';

export function pathLength(path: Path): number {
  const { waypoints } = path;
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

export function positionAtDistance(
  path: Path,
  distance: number,
): { x: number; y: number } {
  const { waypoints } = path;
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (distance <= 0) return { x: waypoints[0].x, y: waypoints[0].y };

  let remaining = distance;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= segLen) {
      const t = remaining / segLen;
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
    remaining -= segLen;
  }

  const last = waypoints[waypoints.length - 1];
  return { x: last.x, y: last.y };
}
