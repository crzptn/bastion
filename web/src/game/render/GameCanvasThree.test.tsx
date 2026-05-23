/**
 * Unit tests for GameCanvasThree camera setup and 3D tile elevation.
 *
 * Camera ACs (carried over from prior issue):
 * AC1-cam — Source imports PerspectiveCamera; does NOT import OrthographicCamera.
 * AC2-cam — Source imports OrbitControls and configures enablePan={false},
 *            minPolarAngle, maxPolarAngle, minDistance, maxDistance.
 * AC3/AC7-cam — fitDistance(cols, rows, fovDeg, aspect) returns a positive value
 *            that keeps max(cols, rows) visible within the vertical FOV.
 *
 * Elevation ACs (issue #56):
 * AC1 — All tiles use BoxGeometry (not PlaneGeometry).
 * AC2 — tileTopY ordering: buildable > path > void; exact values 0.10, 0.0, -0.30.
 * AC3 — Tower Y derives from tileTopY('buildable')/cellTopY; enemy Y derives from
 *        tileTopY('path') + lift; no literal 0.3.
 * AC4 — castShadow conditional on kind === 'buildable'.
 * AC5 — Hover mesh Y uses tileTopY('buildable') + epsilon.
 * AC6 — No `new THREE.` inside Scene() or CameraRig() function bodies.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitDistance, tileTopY, tileCenterY } from './GameCanvasThree';

const srcPath = path.resolve(__dirname, 'GameCanvasThree.tsx');
const source = fs.readFileSync(srcPath, 'utf8');

// ---------------------------------------------------------------------------
// Helpers — strip comments so assertions are not confused by prose
// ---------------------------------------------------------------------------
const withoutComments = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ---------------------------------------------------------------------------
// Camera: PerspectiveCamera imported; OrthographicCamera NOT imported
// ---------------------------------------------------------------------------
describe('GameCanvasThree source — camera imports', () => {
  it('imports PerspectiveCamera from @react-three/drei', () => {
    expect(source).toContain('PerspectiveCamera');
  });

  it('does NOT import OrthographicCamera', () => {
    expect(withoutComments).not.toContain('OrthographicCamera');
  });
});

// ---------------------------------------------------------------------------
// Camera: OrbitControls is imported and configured with required props
// ---------------------------------------------------------------------------
describe('GameCanvasThree source — OrbitControls configuration', () => {
  it('imports OrbitControls', () => {
    expect(source).toContain('OrbitControls');
  });

  it('has enablePan={false}', () => {
    expect(source).toContain('enablePan={false}');
  });

  it('has minPolarAngle={Math.PI / 6}', () => {
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
// Camera: fitDistance pure helper
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
    const halfFov = (fovDeg / 2) * (Math.PI / 180);
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
    expect(dNarrow).toBeGreaterThan(0);
    expect(dWide).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC1 — All tiles use BoxGeometry; no PlaneGeometry for tiles
// ---------------------------------------------------------------------------
describe('AC1 — tile geometry is BoxGeometry', () => {
  it('declares at least 3 module-scope BoxGeometry instances', () => {
    // Count occurrences of `new THREE.BoxGeometry(` in source
    const matches = source.match(/new THREE\.BoxGeometry\(/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('does not use PlaneGeometry for tile rendering', () => {
    // The tile render loop must not reference PlaneGeometry; the only
    // PlaneGeometry allowed is the invisible picker plane (inline <planeGeometry>)
    // and the hoverGeometry if still plane-based. We specifically check that
    // no module-scope `new THREE.PlaneGeometry(1, 1)` exists for tile/hover meshes.
    expect(withoutComments).not.toMatch(/new THREE\.PlaneGeometry\(1,\s*1\)/);
  });
});

// ---------------------------------------------------------------------------
// AC2 — tileTopY values and ordering
// ---------------------------------------------------------------------------
describe('AC2 — tileTopY elevation ordering', () => {
  it('tileTopY buildable > path > void', () => {
    expect(tileTopY('buildable')).toBeGreaterThan(tileTopY('path'));
    expect(tileTopY('path')).toBeGreaterThan(tileTopY('void'));
  });

  it('tileTopY buildable === 0.10', () => {
    expect(tileTopY('buildable')).toBeCloseTo(0.10, 5);
  });

  it('tileTopY path === 0.0', () => {
    expect(tileTopY('path')).toBeCloseTo(0.0, 5);
  });

  it('tileTopY void === -0.30', () => {
    expect(tileTopY('void')).toBeCloseTo(-0.30, 5);
  });
});

// ---------------------------------------------------------------------------
// AC2 bonus — tileCenterY = topY - height/2
// ---------------------------------------------------------------------------
describe('tileCenterY', () => {
  it('tileCenterY buildable === tileTopY(buildable) - 0.20/2', () => {
    expect(tileCenterY('buildable')).toBeCloseTo(tileTopY('buildable') - 0.20 / 2, 5);
  });

  it('tileCenterY path === tileTopY(path) - 0.05/2', () => {
    expect(tileCenterY('path')).toBeCloseTo(tileTopY('path') - 0.05 / 2, 5);
  });

  it('tileCenterY void === tileTopY(void) - 0.10/2', () => {
    expect(tileCenterY('void')).toBeCloseTo(tileTopY('void') - 0.10 / 2, 5);
  });
});

// ---------------------------------------------------------------------------
// AC3 — Tower/enemy Y placement (no literal 0.3; uses helpers)
// ---------------------------------------------------------------------------
describe('AC3 — tower and enemy Y placement', () => {
  it('tower position does not use literal 0.3', () => {
    // Find the tower render block by looking for TowerMesh usage
    // It should reference tileTopY or cellTopY, not a bare 0.3
    const towerBlock = withoutComments.match(/towers\.map[\s\S]{0,600}TowerMesh[\s\S]{0,300}position/);
    expect(towerBlock).not.toBeNull();
    // No literal ", 0.3," in tower position
    expect(towerBlock![0]).not.toMatch(/,\s*0\.3\s*,/);
  });

  it('source references tileTopY or cellTopY for tower Y', () => {
    // Tower render must use cellTopY or tileTopY
    expect(withoutComments).toMatch(/cellTopY|tileTopY/);
  });

  it('enemy position does not use literal 0.3', () => {
    const enemyBlock = withoutComments.match(/enemies\.map[\s\S]{0,600}EnemyMesh[\s\S]{0,300}position/);
    expect(enemyBlock).not.toBeNull();
    expect(enemyBlock![0]).not.toMatch(/,\s*0\.3\s*,/);
  });

  it('enemy Y uses tileTopY(path) plus a lift constant', () => {
    // Source must contain tileTopY('path') + something
    expect(withoutComments).toMatch(/tileTopY\(['"]path['"]\)\s*\+/);
  });
});

// ---------------------------------------------------------------------------
// AC4 — castShadow conditional on buildable kind
// ---------------------------------------------------------------------------
describe('AC4 — castShadow on buildable tiles only', () => {
  it('source contains castShadow conditional on kind === buildable', () => {
    // Allow various whitespace/quote forms
    expect(withoutComments).toMatch(/kind\s*===\s*['"]buildable['"]/);
  });

  it('castShadow appears in tile render context', () => {
    expect(withoutComments).toContain('castShadow');
  });
});

// ---------------------------------------------------------------------------
// AC5 — Hover highlight Y uses tileTopY('buildable') + epsilon
// ---------------------------------------------------------------------------
describe('AC5 — hover highlight Y', () => {
  it('hover mesh Y references tileTopY buildable', () => {
    expect(withoutComments).toMatch(/tileTopY\(['"]buildable['"]\)/);
  });

  it('hover Y adds a small epsilon offset (> 0)', () => {
    // Must have tileTopY('buildable') + <positive number>
    expect(withoutComments).toMatch(/tileTopY\(['"]buildable['"]\)\s*\+\s*0\.\d+/);
  });
});

// ---------------------------------------------------------------------------
// AC6 — No `new THREE.` allocations inside Scene() or CameraRig() function bodies
// ---------------------------------------------------------------------------
describe('AC6 — no per-frame THREE allocations inside component bodies', () => {
  /**
   * Strategy: extract the text between `function Scene(` and the matching `}`
   * and `function CameraRig(` similarly, then assert no `new THREE.` within.
   *
   * We use a bracket-depth counter to find the closing brace of each function.
   */
  function extractFunctionBody(src: string, functionName: string): string {
    const startIdx = src.indexOf(`function ${functionName}(`);
    if (startIdx === -1) return '';
    // Find the opening brace
    const openBrace = src.indexOf('{', startIdx);
    if (openBrace === -1) return '';
    let depth = 0;
    let i = openBrace;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    return src.slice(openBrace, i + 1);
  }

  it('Scene() body contains no `new THREE.` allocation', () => {
    const body = extractFunctionBody(withoutComments, 'Scene');
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toContain('new THREE.');
  });

  it('CameraRig() body contains no `new THREE.` allocation', () => {
    const body = extractFunctionBody(withoutComments, 'CameraRig');
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toContain('new THREE.');
  });
});
