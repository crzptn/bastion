/**
 * Unit tests for the TracerField module.
 *
 * AC2 — lerpTracerPosition returns correct positions at t=0, 0.5, 1; TRACER_MS <= 150.
 * AC3 — All 'new THREE.' allocations appear before the first PascalCase component definition.
 * AC4 — MAX_TRACERS === 200; ring-buffer push capped at MAX_TRACERS entries.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lerpTracerPosition, MAX_TRACERS, TRACER_MS } from './tracers';

// ---------------------------------------------------------------------------
// AC2 — lerpTracerPosition pure helper
// ---------------------------------------------------------------------------
describe('lerpTracerPosition', () => {
  const origin: [number, number, number] = [0, 0, 0];
  const target: [number, number, number] = [10, 4, -6];

  it('returns origin at t=0', () => {
    const result = lerpTracerPosition(origin, target, 0);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0);
  });

  it('returns target at t=1', () => {
    const result = lerpTracerPosition(origin, target, 1);
    expect(result[0]).toBeCloseTo(10);
    expect(result[1]).toBeCloseTo(4);
    expect(result[2]).toBeCloseTo(-6);
  });

  it('returns midpoint at t=0.5', () => {
    const result = lerpTracerPosition(origin, target, 0.5);
    expect(result[0]).toBeCloseTo(5);
    expect(result[1]).toBeCloseTo(2);
    expect(result[2]).toBeCloseTo(-3);
  });

  it('clamps t < 0 to origin', () => {
    const result = lerpTracerPosition(origin, target, -0.5);
    expect(result[0]).toBeCloseTo(0);
  });

  it('clamps t > 1 to target', () => {
    const result = lerpTracerPosition(origin, target, 1.5);
    expect(result[0]).toBeCloseTo(10);
  });
});

// ---------------------------------------------------------------------------
// AC2 — TRACER_MS constant
// ---------------------------------------------------------------------------
describe('TRACER_MS', () => {
  it('is <= 150 ms (tracer travels within 150 ms)', () => {
    expect(TRACER_MS).toBeLessThanOrEqual(150);
  });

  it('is a positive number', () => {
    expect(TRACER_MS).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC4 — MAX_TRACERS constant and ring-buffer cap
// ---------------------------------------------------------------------------
describe('MAX_TRACERS', () => {
  it('equals 200', () => {
    expect(MAX_TRACERS).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// AC4 — pushTracer ring-buffer keeps length at MAX_TRACERS
// ---------------------------------------------------------------------------
import { pushTracer } from './tracers';
import type { TracerSlot } from './tracers';

describe('pushTracer ring-buffer', () => {
  it('pushing more than MAX_TRACERS slots keeps length at MAX_TRACERS', () => {
    const buf: TracerSlot[] = [];
    const slot: TracerSlot = {
      id: 'x',
      originX: 0, originY: 0, originZ: 0,
      targetX: 1, targetY: 1, targetZ: 1,
      startMs: 0,
    };
    for (let i = 0; i < MAX_TRACERS + 50; i++) {
      pushTracer(buf, { ...slot, id: String(i) });
    }
    expect(buf.length).toBe(MAX_TRACERS);
  });

  it('oldest slot is dropped when buffer is full', () => {
    const buf: TracerSlot[] = [];
    const slot: TracerSlot = {
      id: 'first',
      originX: 0, originY: 0, originZ: 0,
      targetX: 1, targetY: 1, targetZ: 1,
      startMs: 0,
    };
    pushTracer(buf, slot);
    for (let i = 0; i < MAX_TRACERS; i++) {
      pushTracer(buf, { ...slot, id: String(i) });
    }
    // 'first' should have been evicted
    expect(buf.some((s) => s.id === 'first')).toBe(false);
    expect(buf.length).toBe(MAX_TRACERS);
  });
});

// ---------------------------------------------------------------------------
// AC3 — all 'new THREE.' allocations appear before first PascalCase component
// ---------------------------------------------------------------------------
describe('tracers.tsx source — geometries/materials at module scope', () => {
  it('all new THREE. allocations precede the first component (arrow/function) definition', () => {
    const srcPath = path.resolve(__dirname, 'tracers.tsx');
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
      // No THREE allocations — acceptable if truly none needed (unlikely for this component)
      return;
    }

    // Find position of first PascalCase const definition (React component).
    // Matches both `const Foo` (module-private) and `export const Foo` (re-exported).
    const componentPattern = /^(?:export )?const [A-Z][a-z]/m;
    const firstComponent = source.search(componentPattern);

    expect(firstComponent).not.toBe(-1);
    expect(
      lastNewThree,
      'last "new THREE." allocation must appear before first component definition',
    ).toBeLessThan(firstComponent);
  });
});
