export type {
  Cell,
  EnemyDef,
  EnemyInstance,
  GamePhase,
  Grid,
  Path,
  RunState,
  TowerDef,
  TowerInstance,
  WaveDef,
} from './types';

export { createInitialRunState, ENEMY_DEFS, TOWER_DEFS } from './constants';

export { canPlaceTower, cellAt, distanceAlongPath } from './logic';

export { STARTER_MAP } from './maps/starter';

export { spawnWave, tickEnemies, enemyPosition } from './sim/enemies';

export { pathLength, positionAtDistance } from './sim/path';

