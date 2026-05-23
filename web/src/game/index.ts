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

export { canPlaceTower, cellAt, distanceAlongPath, placeTower } from './logic';

export { STARTER_MAP } from './maps/starter';

export { spawnWave, tickEnemies, enemyPosition } from './sim/enemies';

export { tickCombat } from './sim/combat';

export { pathLength, positionAtDistance } from './sim/path';

