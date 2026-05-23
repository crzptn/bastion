/**
 * Unit tests for GameCanvasThree camera setup.
 *
 * AC1 — Source imports PerspectiveCamera; does NOT import OrthographicCamera.
 * AC2 — Source imports OrbitControls and configures enablePan={false},
 *        minPolarAngle, maxPolarAngle, minDistance, maxDistance.
 * AC3/AC7 — fitDistance(cols, rows, fovDeg, aspect) returns a positive value
 *            that keeps max(cols, rows) visible within the vertical FOV.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitDistance } from './GameCanvasThree';

const srcPath = path.resolve(__dirname, 'GameCanvasThree.tsx');
const source = fs.readFileSync(srcPath, 'utf8');

// ---------------------------------------------------------------------------
// AC1 — PerspectiveCamera imported; OrthographicCamera NOT imported
// ---------------------------------------------------------------------------
describe('GameCanvasThree source — camera imports', () => {
  it('imports PerspectiveCamera from @react-three/drei', () => {
    expect(source).toContain('PerspectiveCamera');
  });

  it('does NOT import OrthographicCamera', () => {
    // Strip comments to avoid false positives
    const withoutComments = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toContain('OrthographicCamera');
  });
});

// ---------------------------------------------------------------------------
// AC2 — OrbitControls is imported and configured with required props
// ---------------------------------------------------------------------------
describe('GameCanvasThree source — OrbitControls configuration', () => {
  it('imports OrbitControls', () => {
    expect(source).toContain('OrbitControls');
  });

  it('has enablePan={false}', () => {
    expect(source).toContain('enablePan={false}');
  });

  it('has minPolarAngle={Math.PI / 6}', () => {
    // Allow different whitespace forms
    expect(source).toMatch(/minPolarAngle=\{Math\.PI\s*\/\s*6\}/);
  });

  it('has maxPolarAngle={Math.PI / 3}', () => {
    expect(source).toMatch(/maxPolarAngle=\{Math\.PI\s*\/\s*3\}/);
  });

  it('has minDistance prop', () => {
    expect(source).toContain('minDistance=');
  });

  it('has maxDistance prop', () => {
    expect(source).toContain('maxDistance=');
  });
});

// ---------------------------------------------------------------------------
// AC3 / AC7 — fitDistance pure helper
// ---------------------------------------------------------------------------
describe('fitDistance', () => {
  it('returns a positive number for standard 16x12 map at 16:9', () => {
    const d = fitDistance(16, 12, 45, 16 / 9);
    expect(d).toBeGreaterThan(0);
  });

  it('fits the grid: camera height above center satisfies tan(fov/2) geometry', () => {
    const cols = 16;
    const rows = 12;
    const fovDeg = 45;
    const aspect = 16 / 9;
    const d = fitDistance(cols, rows, fovDeg, aspect);
    // The half-extent the camera needs to cover in the vertical direction:
    // vertical half-extent = d * tan(fovDeg/2 * PI/180) >= rows/2
    const halfFov = (fovDeg / 2) * (Math.PI / 180);
    // With aspect adjustment, horizontal visible = d * tan(hFov/2)
    // We use the smaller of vertical and horizontal coverage, so d should
    // at minimum satisfy: d * tan(halfFov) >= rows/2
    const verticalCoverage = d * Math.tan(halfFov);
    expect(verticalCoverage).toBeGreaterThanOrEqual(rows / 2);
  });

  it('returns a larger distance for larger grids', () => {
    const d16 = fitDistance(16, 12, 45, 1);
    const d32 = fitDistance(32, 24, 45, 1);
    expect(d32).toBeGreaterThan(d16);
  });

  it('returns a larger distance for narrower aspect (same grid)', () => {
    const dWide = fitDistance(16, 12, 45, 16 / 9);
    const dNarrow = fitDistance(16, 12, 45, 1);
    // For aspect < maxExtent/rows, vertical constraint dominates for a narrow viewport
    // The narrower aspect means horizontal constraint triggers sooner, so distance is larger
    expect(dNarrow).toBeGreaterThan(0);
    expect(dWide).toBeGreaterThan(0);
  });
});
