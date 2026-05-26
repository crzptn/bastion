// sim.go — pure simulation functions ported from the TypeScript sources.
//
// Source of truth for the algorithms:
//
//	web/src/game/sim/waves.ts      (tickWaves, startWave)
//	web/src/game/sim/enemies.ts    (tickEnemies)
//	web/src/game/sim/combat.ts     (tickCombat)
//	web/src/game/logic.ts          (placeTower)
//	web/src/game/sim/path.ts       (pathLength, positionAtDistance)
//
// No net/http, no external packages beyond the Go standard library.
package session

import (
	"fmt"
	"math"
)

// --- Path helpers (ported from web/src/game/sim/path.ts) ---

// pathLength returns the total length of the starter map path in grid units.
func pathLength() float64 {
	wps := starterPathWaypoints
	total := 0.0
	for i := 0; i < len(wps)-1; i++ {
		a, b := wps[i], wps[i+1]
		dx := float64(b[0] - a[0])
		dy := float64(b[1] - a[1])
		total += math.Hypot(dx, dy)
	}
	return total
}

// positionAtDistance returns the (x, y) position along the starter map path
// at the given cumulative distance.
func positionAtDistance(distance float64) (x, y float64) {
	wps := starterPathWaypoints
	if len(wps) == 0 {
		return 0, 0
	}
	if distance <= 0 {
		return float64(wps[0][0]), float64(wps[0][1])
	}
	remaining := distance
	for i := 0; i < len(wps)-1; i++ {
		a, b := wps[i], wps[i+1]
		dx := float64(b[0] - a[0])
		dy := float64(b[1] - a[1])
		segLen := math.Hypot(dx, dy)
		if remaining <= segLen {
			t := remaining / segLen
			return float64(a[0]) + t*dx, float64(a[1]) + t*dy
		}
		remaining -= segLen
	}
	last := wps[len(wps)-1]
	return float64(last[0]), float64(last[1])
}

// --- startWave (ported from web/src/game/sim/waves.ts) ---

// applyStartWave transitions a RunState from prep to combat and builds the
// spawn queue. Returns the same state unchanged if preconditions are not met.
func applyStartWave(state RunState) RunState {
	if state.Phase != PhasePrep {
		return state
	}
	if state.WaveIndex >= len(Waves) {
		return state
	}
	if state.BaseHP <= 0 {
		return state
	}

	waveDef := Waves[state.WaveIndex]
	spawnQueue := make([]PendingSpawn, 0, len(waveDef.Enemies))
	for _, g := range waveDef.Enemies {
		spawnQueue = append(spawnQueue, PendingSpawn{
			DefID:     g.DefID,
			Remaining: g.Count,
			Interval:  g.Interval,
		})
	}

	var firstInterval float64
	if len(spawnQueue) > 0 {
		firstInterval = spawnQueue[0].Interval
	}

	return RunState{
		Gold:        state.Gold,
		BaseHP:      state.BaseHP,
		WaveIndex:   state.WaveIndex,
		Phase:       PhaseCombat,
		Towers:      state.Towers,
		Enemies:     state.Enemies,
		NextEnemyID: state.NextEnemyID,
		Tick:        state.Tick,
		WaveProgress: &WaveProgress{
			SpawnQueue:         spawnQueue,
			TimeUntilNextSpawn: firstInterval,
		},
	}
}

// --- tickWaves (ported from web/src/game/sim/waves.ts) ---

// tickWaves advances wave spawning by dtSeconds. Must be called before
// tickEnemies each tick. Returns state unchanged if phase != combat or
// WaveProgress is nil.
func tickWaves(state RunState, dtSeconds float64) RunState {
	if state.Phase != PhaseCombat {
		return state
	}
	if state.WaveProgress == nil {
		return state
	}

	spawnQueue := append([]PendingSpawn(nil), state.WaveProgress.SpawnQueue...)
	timeUntilNextSpawn := state.WaveProgress.TimeUntilNextSpawn - dtSeconds
	nextEnemyID := state.NextEnemyID
	var newEnemies []Enemy

	for timeUntilNextSpawn <= 0 && len(spawnQueue) > 0 {
		head := spawnQueue[0]
		def, ok := EnemyDefs[head.DefID]
		hp := 1
		if ok {
			hp = def.HP
		}
		newEnemies = append(newEnemies, Enemy{
			ID:                fmt.Sprintf("enemy-%d", nextEnemyID),
			DefID:             head.DefID,
			DistanceTravelled: 0,
			HP:                hp,
		})
		nextEnemyID++

		nextRemaining := head.Remaining - 1
		if nextRemaining <= 0 {
			spawnQueue = spawnQueue[1:]
			if len(spawnQueue) > 0 {
				timeUntilNextSpawn += spawnQueue[0].Interval
			}
		} else {
			spawnQueue[0] = PendingSpawn{
				DefID:     head.DefID,
				Remaining: nextRemaining,
				Interval:  head.Interval,
			}
			timeUntilNextSpawn += head.Interval
		}
	}

	updatedEnemies := state.Enemies
	if len(newEnemies) > 0 {
		updatedEnemies = append(
			append([]Enemy(nil), state.Enemies...),
			newEnemies...)
	}

	allSpawned := len(spawnQueue) == 0
	boardEmpty := len(updatedEnemies) == 0

	if allSpawned && boardEmpty {
		nextWaveIndex := state.WaveIndex + 1
		isFinal := nextWaveIndex >= len(Waves)
		phase := PhasePrep
		if isFinal {
			phase = PhaseVictory
		}
		return RunState{
			Gold:         state.Gold,
			BaseHP:       state.BaseHP,
			WaveIndex:    nextWaveIndex,
			Phase:        phase,
			Towers:       state.Towers,
			Enemies:      updatedEnemies,
			WaveProgress: nil,
			NextEnemyID:  nextEnemyID,
			Tick:         state.Tick,
		}
	}

	return RunState{
		Gold:      state.Gold,
		BaseHP:    state.BaseHP,
		WaveIndex: state.WaveIndex,
		Phase:     state.Phase,
		Towers:    state.Towers,
		Enemies:   updatedEnemies,
		WaveProgress: &WaveProgress{
			SpawnQueue:         spawnQueue,
			TimeUntilNextSpawn: timeUntilNextSpawn,
		},
		NextEnemyID: nextEnemyID,
		Tick:        state.Tick,
	}
}

// --- tickEnemies (ported from web/src/game/sim/enemies.ts) ---

// tickEnemies moves all enemies along the path by dtSeconds. Enemies that
// reach the end of the path are removed and reduce BaseHP by 1 each.
// Returns state unchanged when phase != combat.
func tickEnemies(state RunState, dtSeconds float64) RunState {
	if state.Phase != PhaseCombat {
		return state
	}

	total := pathLength()
	surviving := make([]Enemy, 0, len(state.Enemies))
	leaks := 0

	for _, enemy := range state.Enemies {
		def, ok := EnemyDefs[enemy.DefID]
		speed := 1.0
		if ok {
			speed = def.Speed
		}
		next := enemy.DistanceTravelled + speed*dtSeconds
		if next >= total {
			leaks++
		} else {
			e := enemy
			e.DistanceTravelled = next
			surviving = append(surviving, e)
		}
	}

	newBaseHP := state.BaseHP - leaks
	phase := state.Phase
	if newBaseHP <= 0 {
		phase = PhaseGameover
	}

	return RunState{
		Gold:         state.Gold,
		BaseHP:       newBaseHP,
		WaveIndex:    state.WaveIndex,
		Phase:        phase,
		Towers:       state.Towers,
		Enemies:      surviving,
		WaveProgress: state.WaveProgress,
		NextEnemyID:  state.NextEnemyID,
		Tick:         state.Tick,
	}
}

// --- tickCombat (ported from web/src/game/sim/combat.ts) ---

// tickCombat processes tower firing for one tick. Targeting: furthest-along
// in-range enemy (same as the TS implementation). Returns state unchanged
// when phase != combat or no towers/enemies.
func tickCombat(state RunState, dtSeconds float64) RunState {
	if state.Phase != PhaseCombat {
		return state
	}
	if len(state.Towers) == 0 || len(state.Enemies) == 0 {
		return state
	}

	hpMap := make(map[string]int, len(state.Enemies))
	for _, e := range state.Enemies {
		hpMap[e.ID] = e.HP
	}

	cooldowns := make(map[string]float64, len(state.Towers))
	for _, t := range state.Towers {
		cooldowns[t.ID] = t.CooldownRemaining
	}

	goldEarned := 0

	for _, tower := range state.Towers {
		def, ok := TowerDefs[tower.DefID]
		if !ok {
			continue
		}

		prevCD := cooldowns[tower.ID]
		nextCD := prevCD - dtSeconds
		cooldowns[tower.ID] = nextCD
		if nextCD > 0 {
			continue
		}

		towerCX := float64(tower.X) + 0.5
		towerCY := float64(tower.Y) + 0.5
		var bestID string
		bestDist := -1.0

		for _, enemy := range state.Enemies {
			hp, exists := hpMap[enemy.ID]
			if !exists || hp <= 0 {
				continue
			}
			ex, ey := positionAtDistance(enemy.DistanceTravelled)
			distToTower := math.Hypot(towerCX-ex, towerCY-ey)
			if distToTower <= def.Range && enemy.DistanceTravelled > bestDist {
				bestDist = enemy.DistanceTravelled
				bestID = enemy.ID
			}
		}

		if bestID == "" {
			continue
		}

		prevHP := hpMap[bestID]
		newHP := prevHP - def.Damage
		hpMap[bestID] = newHP
		if newHP <= 0 {
			if eDef, ok2 := EnemyDefs[getEnemyDefID(state.Enemies, bestID)]; ok2 {
				goldEarned += eDef.Reward
			}
		}
		cooldowns[tower.ID] = 1.0 / def.FireRate
	}

	// Build new enemies (filter dead, update hp).
	nextEnemies := make([]Enemy, 0, len(state.Enemies))
	for _, enemy := range state.Enemies {
		newHP, ok := hpMap[enemy.ID]
		if !ok {
			newHP = enemy.HP
		}
		if newHP <= 0 {
			continue
		}
		e := enemy
		e.HP = newHP
		nextEnemies = append(nextEnemies, e)
	}

	// Build new towers (update cooldowns).
	nextTowers := make([]Tower, len(state.Towers))
	for i, t := range state.Towers {
		nt := t
		nt.CooldownRemaining = cooldowns[t.ID]
		nextTowers[i] = nt
	}

	return RunState{
		Gold:         state.Gold + goldEarned,
		BaseHP:       state.BaseHP,
		WaveIndex:    state.WaveIndex,
		Phase:        state.Phase,
		Towers:       nextTowers,
		Enemies:      nextEnemies,
		WaveProgress: state.WaveProgress,
		NextEnemyID:  state.NextEnemyID,
		Tick:         state.Tick,
	}
}

// getEnemyDefID is a helper to look up the defId for an enemy by ID.
func getEnemyDefID(enemies []Enemy, id string) string {
	for _, e := range enemies {
		if e.ID == id {
			return e.DefID
		}
	}
	return ""
}

// --- placeTower (ported from web/src/game/logic.ts) ---

// placeTower validates and applies a tower placement intent.
// Returns the updated state and placed=true on success.
// Rejects: wrong phase, non-buildable cell, occupied cell, unknown def, insufficient gold.
func placeTower(state RunState, defID string, x, y int) (RunState, bool) {
	if state.Phase != PhasePrep {
		return state, false
	}
	def, ok := TowerDefs[defID]
	if !ok {
		return state, false
	}
	if !IsBuildable(x, y) {
		return state, false
	}
	for _, t := range state.Towers {
		if t.X == x && t.Y == y {
			return state, false
		}
	}
	if state.Gold < def.Cost {
		return state, false
	}

	tower := Tower{
		ID:                fmt.Sprintf("%s-%d-%d", defID, x, y),
		DefID:             defID,
		X:                 x,
		Y:                 y,
		CooldownRemaining: 0,
	}

	newTowers := append(append([]Tower(nil), state.Towers...), tower)
	return RunState{
		Gold:         state.Gold - def.Cost,
		BaseHP:       state.BaseHP,
		WaveIndex:    state.WaveIndex,
		Phase:        state.Phase,
		Towers:       newTowers,
		Enemies:      state.Enemies,
		WaveProgress: state.WaveProgress,
		NextEnemyID:  state.NextEnemyID,
		Tick:         state.Tick,
	}, true
}
