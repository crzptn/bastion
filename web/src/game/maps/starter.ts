import type { Grid, Path } from '../types';

const COLS = 20;
const ROWS = 15;

const PATH_WAYPOINTS: { x: number; y: number }[] = [
  { x: 0, y: 7 },
  { x: 4, y: 7 },
  { x: 4, y: 3 },
  { x: 10, y: 3 },
  { x: 10, y: 11 },
  { x: 16, y: 11 },
  { x: 16, y: 7 },
  { x: 19, y: 7 },
];

function buildGrid(): Grid {
  const pathCells = new Set<string>();

  for (let w = 0; w < PATH_WAYPOINTS.length - 1; w++) {
    const from = PATH_WAYPOINTS[w];
    const to = PATH_WAYPOINTS[w + 1];

    if (from.x === to.x) {
      const minY = Math.min(from.y, to.y);
      const maxY = Math.max(from.y, to.y);
      for (let y = minY; y <= maxY; y++) {
        pathCells.add(`${from.x},${y}`);
      }
    } else {
      const minX = Math.min(from.x, to.x);
      const maxX = Math.max(from.x, to.x);
      for (let x = minX; x <= maxX; x++) {
        pathCells.add(`${x},${from.y}`);
      }
    }
  }

  const buildableCells = new Set<string>();
  for (const key of pathCells) {
    const [px, py] = key.split(',').map(Number);
    const neighbours = [
      { x: px - 1, y: py },
      { x: px + 1, y: py },
      { x: px, y: py - 1 },
      { x: px, y: py + 1 },
    ];
    for (const n of neighbours) {
      if (n.x >= 0 && n.x < COLS && n.y >= 0 && n.y < ROWS && !pathCells.has(`${n.x},${n.y}`)) {
        buildableCells.add(`${n.x},${n.y}`);
      }
    }
  }

  const cells = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      cells.push({ x, y, buildable: buildableCells.has(`${x},${y}`) });
    }
  }

  return { cols: COLS, rows: ROWS, cells };
}

export const STARTER_MAP: { grid: Grid; path: Path } = {
  grid: buildGrid(),
  path: { waypoints: PATH_WAYPOINTS },
};
