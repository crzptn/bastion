export type GamePhase = 'prep' | 'combat' | 'gameover';

export type Cell = {
  x: number;
  y: number;
  buildable: boolean;
};

export type Grid = {
  cols: number;
  rows: number;
  cells: Cell[];
};

export type Path = {
  waypoints: readonly { x: number; y: number }[];
};

export type TowerDef = {
  id: string;
  name: string;
  cost: number;
  damage: number;
  range: number;
  fireRate: number;
};

export type TowerInstance = {
  id: string;
  defId: string;
  x: number;
  y: number;
  cooldownRemaining: number;
};

export type EnemyDef = {
  id: string;
  name: string;
  hp: number;
  speed: number;
  reward: number;
};

export type EnemyInstance = {
  id: string;
  defId: string;
  distanceTravelled: number;
  hp: number;
};

export type WaveDef = {
  enemies: {
    defId: string;
    count: number;
    interval: number;
  }[];
};

export type PendingSpawn = {
  defId: string;
  remaining: number;
  interval: number;
};

export type WaveProgress = {
  spawnQueue: PendingSpawn[];
  timeUntilNextSpawn: number;
};

export type RunState = {
  gold: number;
  baseHp: number;
  waveIndex: number;
  phase: GamePhase;
  towers: TowerInstance[];
  enemies: EnemyInstance[];
  waveProgress: WaveProgress | null;
  nextEnemyId: number;
};
