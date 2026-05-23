import type { EnemyDef, RunState, TowerDef } from './types';

export const TOWER_DEFS: Record<string, TowerDef> = {
  cannon: {
    id: 'cannon',
    name: 'Cannon',
    cost: 50,
    damage: 20,
    range: 3,
    fireRate: 0.5,
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    cost: 25,
    damage: 8,
    range: 5,
    fireRate: 1.5,
  },
};

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  goblin: {
    id: 'goblin',
    name: 'Goblin',
    hp: 30,
    speed: 2,
    reward: 10,
  },
};

export const INITIAL_RUN_STATE: RunState = {
  gold: 100,
  baseHp: 20,
  waveIndex: 0,
  phase: 'prep',
  towers: [],
  enemies: [],
};
