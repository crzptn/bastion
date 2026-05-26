/**
 * PlayPage source-read test — verifies the conditional branch that switches
 * from useGameSession (solo) to useSessionMirror (co-op) when ?lobby= is set.
 *
 * Pattern: pure source-read assertion (#67). No DOM rendering required.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, 'PlayPage.tsx'), 'utf-8');

describe('PlayPage source-read assertions', () => {
  it('imports useSessionMirror', () => {
    expect(source).toContain("from '../game/useSessionMirror'");
  });

  it('imports useGameSession (solo mode must still exist)', () => {
    expect(source).toContain('useGameSession');
  });

  it('derives isCoopMode from lobbyId', () => {
    expect(source).toContain('isCoopMode');
  });

  it('uses sessionMirror.state when in co-op mode', () => {
    expect(source).toContain('isCoopMode ? sessionMirror.state : soloSession.state');
  });

  it('sends place_tower intent via sessionMirror.placeTowerAt in co-op mode', () => {
    expect(source).toContain('sessionMirror.placeTowerAt');
  });

  it('sends start_wave intent via sessionMirror.requestStartWave in co-op mode', () => {
    expect(source).toContain('sessionMirror.requestStartWave');
  });

  it('solo mode still calls soloSession.startWave', () => {
    expect(source).toContain('soloSession.startWave()');
  });

  it('solo mode still calls soloSession.placeTowerAt', () => {
    expect(source).toContain('soloSession.placeTowerAt(pos)');
  });

  it('restart button is hidden in co-op mode', () => {
    // The restart button must be behind !isCoopMode guard.
    expect(source).toContain('!isCoopMode');
    expect(source).toContain('soloSession.restart');
  });

  it('gold label is prefixed with Shared in co-op mode', () => {
    // The HUD must render 'Shared Gold' when isCoopMode is true.
    expect(source).toContain('Shared Gold');
    // The conditional must gate on isCoopMode.
    const goldIdx = source.indexOf('Shared Gold');
    const coopIdx = source.lastIndexOf('isCoopMode', goldIdx);
    expect(coopIdx).toBeGreaterThan(-1);
  });

  it('base HP label is prefixed with Shared in co-op mode', () => {
    // The HUD must render 'Shared Base HP' when isCoopMode is true.
    expect(source).toContain('Shared Base HP');
    // The conditional must gate on isCoopMode.
    const hpIdx = source.indexOf('Shared Base HP');
    const coopIdx = source.lastIndexOf('isCoopMode', hpIdx);
    expect(coopIdx).toBeGreaterThan(-1);
  });
});
