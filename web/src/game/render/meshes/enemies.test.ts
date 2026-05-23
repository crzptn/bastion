/**
 * Unit tests for enemies mesh registry.
 *
 * AC2 — ENEMY_MESHES is a superset of ENEMY_DEFS keys; each entry is a function.
 * AC3 — No hex literals in enemies.tsx source (all colors come from THEME).
 * AC7 — All 'new THREE.' allocations appear before any component definition.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS } from '../../constants';
import { ENEMY_MESHES, PLACEHOLDER_ENEMY_MESH } from './enemies';

// ---------------------------------------------------------------------------
// AC2 — registry coverage
// ---------------------------------------------------------------------------
describe('ENEMY_MESHES registry', () => {
  it('contains a key for every id in ENEMY_DEFS', () => {
    for (const id of Object.keys(ENEMY_DEFS)) {
      expect(ENEMY_MESHES).toHaveProperty(id);
    }
  });

  it('each entry is a function (React component)', () => {
    for (const [id, Component] of Object.entries(ENEMY_MESHES)) {
      expect(typeof Component, `ENEMY_MESHES["${id}"] should be a function`).toBe('function');
    }
  });

  it('PLACEHOLDER_ENEMY_MESH is a function', () => {
    expect(typeof PLACEHOLDER_ENEMY_MESH).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// AC3 — no hardcoded hex literals in the source file
// ---------------------------------------------------------------------------
describe('ENEMY_MESHES source — no hardcoded hex colors', () => {
  it('enemies.tsx contains no "#" hex color literals', () => {
    const srcPath = path.resolve(__dirname, 'enemies.tsx');
    const source = fs.readFileSync(srcPath, 'utf8');
    // Strip comments to avoid false positives
    const withoutComments = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const hexMatches = withoutComments.match(/'#[0-9a-fA-F]{3,8}'/g);
    expect(
      hexMatches,
      `Found hardcoded hex literals in enemies.ts: ${JSON.stringify(hexMatches)}`,
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC7 — all 'new THREE.' calls appear before any component definition
// ---------------------------------------------------------------------------
describe('ENEMY_MESHES source — geometries/materials at module scope', () => {
  it('all new THREE. allocations precede the first component (arrow/function) definition', () => {
    const srcPath = path.resolve(__dirname, 'enemies.tsx');
    const source = fs.readFileSync(srcPath, 'utf8');

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
      return;
    }

    // Find position of first PascalCase const definition (React component).
    // Module-scope allocations use camelCase (e.g. goblinGeometry) so they
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
