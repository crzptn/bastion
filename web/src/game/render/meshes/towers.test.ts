/**
 * Unit tests for towers mesh registry.
 *
 * AC1 — TOWER_MESHES is a superset of TOWER_DEFS keys; each entry is a function.
 * AC3 — No hex literals in towers.tsx source (all colors come from THEME).
 * AC7 — All 'new THREE.' allocations appear before any component definition.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOWER_DEFS } from '../../constants';
import { PLACEHOLDER_TOWER_MESH, TOWER_MESHES } from './towers';

// ---------------------------------------------------------------------------
// AC1 — registry coverage
// ---------------------------------------------------------------------------
describe('TOWER_MESHES registry', () => {
  it('contains a key for every id in TOWER_DEFS', () => {
    for (const id of Object.keys(TOWER_DEFS)) {
      expect(TOWER_MESHES).toHaveProperty(id);
    }
  });

  it('each entry is a function (React component)', () => {
    for (const [id, Component] of Object.entries(TOWER_MESHES)) {
      expect(typeof Component, `TOWER_MESHES["${id}"] should be a function`).toBe('function');
    }
  });

  it('PLACEHOLDER_TOWER_MESH is a function', () => {
    expect(typeof PLACEHOLDER_TOWER_MESH).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// AC3 — no hardcoded hex literals in the source file
// ---------------------------------------------------------------------------
describe('TOWER_MESHES source — no hardcoded hex colors', () => {
  it('towers.tsx contains no "#" hex color literals', () => {
    const srcPath = path.resolve(__dirname, 'towers.tsx');
    const source = fs.readFileSync(srcPath, 'utf8');
    // Strip single-line comments to avoid false positives in comments
    const withoutComments = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const hexMatches = withoutComments.match(/'#[0-9a-fA-F]{3,8}'/g);
    expect(
      hexMatches,
      `Found hardcoded hex literals in towers.ts: ${JSON.stringify(hexMatches)}`,
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC7 — all 'new THREE.' calls appear before any component definition
// ---------------------------------------------------------------------------
describe('TOWER_MESHES source — geometries/materials at module scope', () => {
  it('all new THREE. allocations precede the first component (arrow/function) definition', () => {
    const srcPath = path.resolve(__dirname, 'towers.tsx');
    const source = fs.readFileSync(srcPath, 'utf8');

    // Find position of last 'new THREE.'
    const lastNewThree = (() => {
      let pos = -1;
      let idx = source.indexOf('new THREE.');
      while (idx !== -1) {
        pos = idx;
        idx = source.indexOf('new THREE.', idx + 1);
      }
      return pos;
    })();

    if (lastNewThree === -1) {
      // No THREE allocations found — acceptable if none needed
      return;
    }

    // Find position of first PascalCase const definition (React component).
    // Module-scope allocations use camelCase (e.g. cannonBaseGeometry) so they
    // don't match this pattern.
    const componentPattern = /^const [A-Z]/m;
    const firstComponent = source.search(componentPattern);

    expect(firstComponent).not.toBe(-1);
    expect(
      lastNewThree,
      'last "new THREE." allocation must appear before first component definition',
    ).toBeLessThan(firstComponent);
  });
});
