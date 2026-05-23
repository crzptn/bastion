export type {
  Cell,
  EnemyDef,
  EnemyInstance,
  GamePhase,
  Grid,
  Path,
  PendingSpawn,
  RunState,
  TowerDef,
  TowerInstance,
  WaveDef,
  WaveProgress,
} from './types';

export { createInitialRunState, ENEMY_DEFS, TOWER_DEFS } from './constants';

export { canPlaceTower, cellAt, distanceAlongPath, placeTower } from './logic';

export { STARTER_MAP } from './maps/starter';

export { spawnWave, tickEnemies, enemyPosition } from './sim/enemies';

export { tickCombat } from './sim/combat';

export { pathLength, positionAtDistance } from './sim/path';

export { WAVES, startWave, tickWaves } from './sim/waves';

