import { describe, expect, it } from 'vitest';
import { STARTER_MAP } from './maps/starter';
import { canPlaceTower, cellAt, distanceAlongPath } from './logic';
import type { GamePhase, TowerInstance } from './types';

describe('cellAt', () => {
  const { grid } = STARTER_MAP;

  it('returns the cell at valid coordinates', () => {
    const cell = cellAt(grid, 0, 0);
    expect(cell).toBeDefined();
    expect(cell?.x).toBe(0);
    expect(cell?.y).toBe(0);
  });

  it('returns undefined for negative x', () => {
    expect(cellAt(grid, -1, 0)).toBeUndefined();
  });

  it('returns undefined for negative y', () => {
    expect(cellAt(grid, 0, -1)).toBeUndefined();
  });

  it('returns undefined for x equal to cols', () => {
    expect(cellAt(grid, grid.cols, 0)).toBeUndefined();
  });

  it('returns undefined for y equal to rows', () => {
    expect(cellAt(grid, 0, grid.rows)).toBeUndefined();
  });
});

describe('canPlaceTower', () => {
  const { grid } = STARTER_MAP;

  const buildableCell = grid.cells.find((c) => c.buildable)!;

  it('returns true for a buildable, unoccupied cell', () => {
    expect(canPlaceTower(grid, [], buildableCell.x, buildableCell.y)).toBe(true);
  });

  it('returns false for a non-buildable cell', () => {
    const nonBuildable = grid.cells.find((c) => !c.buildable)!;
    expect(canPlaceTower(grid, [], nonBuildable.x, nonBuildable.y)).toBe(false);
  });

  it('returns false when a tower already occupies the cell', () => {
    const occupied: TowerInstance[] = [
      { id: 't1', defId: 'cannon', x: buildableCell.x, y: buildableCell.y },
    ];
    expect(canPlaceTower(grid, occupied, buildableCell.x, buildableCell.y)).toBe(false);
  });

  it('returns false for out-of-bounds coordinates', () => {
    expect(canPlaceTower(grid, [], -1, -1)).toBe(false);
  });
});

describe('distanceAlongPath', () => {
  const { path } = STARTER_MAP;

  it('returns 0 for the first waypoint', () => {
    const first = path.waypoints[0];
    expect(distanceAlongPath(path, first.x, first.y)).toBeCloseTo(0);
  });

  it('returns positive distance for a later waypoint', () => {
    const second = path.waypoints[1];
    expect(distanceAlongPath(path, second.x, second.y)).toBeGreaterThan(0);
  });

  it('returns total path length for an off-path point', () => {
    expect(distanceAlongPath(path, 15, 0)).toBeCloseTo(35);
  });
});

describe('GamePhase', () => {
  it('accepts all three phase values', () => {
    const phases: GamePhase[] = ['prep', 'combat', 'gameover'];
    expect(phases).toHaveLength(3);
    expect(phases).toContain('prep');
    expect(phases).toContain('combat');
    expect(phases).toContain('gameover');
  });
});

describe('STARTER_MAP', () => {
  const { grid, path } = STARTER_MAP;

  it('has the expected grid dimensions', () => {
    expect(grid.cols).toBe(20);
    expect(grid.rows).toBe(15);
    expect(grid.cells).toHaveLength(20 * 15);
  });

  it('has at least two waypoints', () => {
    expect(path.waypoints.length).toBeGreaterThanOrEqual(2);
  });

  it('has at least one buildable cell', () => {
    expect(grid.cells.some((c) => c.buildable)).toBe(true);
  });
});
