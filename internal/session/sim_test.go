package session

import (
	"fmt"
	"testing"
)

// --- tickEnemies tests (AC1) ---

// TestTickEnemies_Deterministic verifies that the same dt applied twice yields
// the same distance_travelled (AC1: deterministic simulation).
func TestTickEnemies_Deterministic(t *testing.T) {
	state := createInitialRunState()
	state.Phase = PhaseCombat
	state.Enemies = []Enemy{
		{ID: "enemy-0", DefID: "goblin", DistanceTravelled: 0, HP: 30},
	}

	const dt = 1.0 / 30.0

	s1 := tickEnemies(state, dt)
	// Run again from same starting state.
	s2 := tickEnemies(state, dt)

	if len(s1.Enemies) != len(s2.Enemies) {
		t.Fatalf(
			"enemy count mismatch: %d vs %d",
			len(s1.Enemies),
			len(s2.Enemies),
		)
	}
	if len(s1.Enemies) > 0 {
		d1 := s1.Enemies[0].DistanceTravelled
		d2 := s2.Enemies[0].DistanceTravelled
		if d1 != d2 {
			t.Errorf("non-deterministic: run1 dist=%f run2 dist=%f", d1, d2)
		}
		// Goblin speed = 2 cells/s, so dt=1/30 → 2/30 ≈ 0.0667
		want := 2.0 * dt
		if d1 != want {
			t.Errorf("distance: got %f, want %f", d1, want)
		}
	}
}

// TestTickEnemies_NoopOutsideCombat verifies that tickEnemies is a no-op when
// phase is not 'combat'.
func TestTickEnemies_NoopOutsideCombat(t *testing.T) {
	state := createInitialRunState()
	state.Enemies = []Enemy{
		{ID: "enemy-0", DefID: "goblin", DistanceTravelled: 0, HP: 30},
	}
	result := tickEnemies(state, 1.0/30.0)
	if result.Enemies[0].DistanceTravelled != 0 {
		t.Errorf(
			"expected no movement in prep phase, got %f",
			result.Enemies[0].DistanceTravelled,
		)
	}
}

// TestTickEnemies_LeakReducesBaseHP verifies that an enemy reaching the end
// of the path reduces BaseHP by 1.
func TestTickEnemies_LeakReducesBaseHP(t *testing.T) {
	state := createInitialRunState()
	state.Phase = PhaseCombat
	// Put the enemy almost at the end; path total ≈ 34 cells.
	// We'll place it past the end directly.
	state.Enemies = []Enemy{
		{ID: "enemy-0", DefID: "goblin", DistanceTravelled: 999.0, HP: 30},
	}
	result := tickEnemies(state, 1.0/30.0)
	if len(result.Enemies) != 0 {
		t.Errorf(
			"leaked enemy should be removed; got %d enemies",
			len(result.Enemies),
		)
	}
	if result.BaseHP != state.BaseHP-1 {
		t.Errorf("BaseHP: got %d, want %d", result.BaseHP, state.BaseHP-1)
	}
}

// --- placeTower tests (AC3) ---

// TestPlaceTower_Success verifies that a valid placement succeeds and deducts gold.
func TestPlaceTower_Success(t *testing.T) {
	state := createInitialRunState()
	// Find the first buildable cell.
	x, y := firstBuildableCell(t)
	result, placed := placeTower(state, "archer", x, y)
	if !placed {
		t.Fatal("expected placed=true for valid placement")
	}
	if len(result.Towers) != 1 {
		t.Fatalf("tower count: got %d, want 1", len(result.Towers))
	}
	archDef := TowerDefs["archer"]
	if result.Gold != state.Gold-archDef.Cost {
		t.Errorf("gold: got %d, want %d", result.Gold, state.Gold-archDef.Cost)
	}
}

// TestPlaceTower_RejectsUnaffordable verifies that placing a tower with
// insufficient gold returns placed=false (AC3: server validates).
func TestPlaceTower_RejectsUnaffordable(t *testing.T) {
	state := createInitialRunState()
	state.Gold = 0
	x, y := firstBuildableCell(t)
	_, placed := placeTower(state, "archer", x, y)
	if placed {
		t.Error("expected placed=false when gold < cost")
	}
}

// TestPlaceTower_RejectsNonBuildable verifies that placing on a path cell
// returns placed=false (AC3).
func TestPlaceTower_RejectsNonBuildable(t *testing.T) {
	state := createInitialRunState()
	// (0,7) is a path cell on the starter map.
	_, placed := placeTower(state, "archer", 0, 7)
	if placed {
		t.Error("expected placed=false on non-buildable path cell")
	}
}

// TestPlaceTower_RejectsWrongPhase verifies that placing during combat is
// rejected (AC3).
func TestPlaceTower_RejectsWrongPhase(t *testing.T) {
	state := createInitialRunState()
	state.Phase = PhaseCombat
	x, y := firstBuildableCell(t)
	_, placed := placeTower(state, "archer", x, y)
	if placed {
		t.Error("expected placed=false during combat phase")
	}
}

// TestPlaceTower_RejectsOccupied verifies that placing on an already-occupied
// cell returns placed=false.
func TestPlaceTower_RejectsOccupied(t *testing.T) {
	state := createInitialRunState()
	x, y := firstBuildableCell(t)
	state, placed := placeTower(state, "archer", x, y)
	if !placed {
		t.Fatal("first placement must succeed")
	}
	_, placed = placeTower(state, "archer", x, y)
	if placed {
		t.Error("expected placed=false on occupied cell")
	}
}

// TestPlaceTower_RejectsUnknownDef verifies that an unknown def_id is rejected.
func TestPlaceTower_RejectsUnknownDef(t *testing.T) {
	state := createInitialRunState()
	x, y := firstBuildableCell(t)
	_, placed := placeTower(state, "unknown-def", x, y)
	if placed {
		t.Error("expected placed=false for unknown tower def")
	}
}

// --- tickWaves tests ---

// TestTickWaves_NoopOutsideCombat verifies that tickWaves is a no-op outside combat.
func TestTickWaves_NoopOutsideCombat(t *testing.T) {
	state := createInitialRunState()
	result := tickWaves(state, 1.0/30.0)
	if result.Phase != PhasePrep {
		t.Errorf("phase should remain prep, got %q", result.Phase)
	}
}

// TestTickWaves_SpawnsEnemy verifies that tickWaves emits an enemy when timer expires.
func TestTickWaves_SpawnsEnemy(t *testing.T) {
	state := applyStartWave(createInitialRunState())
	if state.Phase != PhaseCombat {
		t.Fatalf("phase after startWave: got %q, want combat", state.Phase)
	}
	// The first interval is 1.5 s. Advance by 2 s to ensure spawn.
	result := tickWaves(state, 2.0)
	if len(result.Enemies) == 0 {
		t.Error("expected at least one enemy after 2s, got 0")
	}
}

// TestTickWaves_WaveClears verifies wave-clear logic: all spawned + board empty → prep.
func TestTickWaves_WaveClears(t *testing.T) {
	state := applyStartWave(createInitialRunState())
	// Drain the entire spawn queue by advancing many seconds in small steps.
	// Wave 0: 5 goblins × 1.5 s interval = 7.5 s total.
	// Then remove all enemies manually to simulate kills, and tick again.
	for range 20 {
		state = tickWaves(state, 0.5)
	}
	// All 5 goblins spawned; now clear the board to trigger wave-clear.
	state.Enemies = []Enemy{}
	// One more tick with empty board and empty queue.
	state = tickWaves(state, 1.0/30.0)
	if state.Phase != PhasePrep {
		t.Errorf(
			"expected prep after wave clears (board empty), got %q",
			state.Phase,
		)
	}
	if state.WaveIndex != 1 {
		t.Errorf("wave index: got %d, want 1", state.WaveIndex)
	}
}

// --- tickCombat tests ---

// TestTickCombat_TowerKillsEnemy verifies that a tower in range kills a goblin
// and awards gold.
func TestTickCombat_TowerKillsEnemy(t *testing.T) {
	state := createInitialRunState()
	state.Phase = PhaseCombat
	// Cell [0,6] is buildable and 0.50 grid units from the path at dist=0.5.
	// Archer range=5, so this is comfortably within range.
	const tx, ty = 0, 6
	state.Towers = []Tower{
		{
			ID:                fmt.Sprintf("archer-%d-%d", tx, ty),
			DefID:             "archer",
			X:                 tx,
			Y:                 ty,
			CooldownRemaining: 0,
		},
	}
	// Enemy at path distance 0.5 ≈ position (0.5, 7.0). Distance to tower center
	// (0.5, 6.5) is 0.5, well within archer range of 5.
	state.Enemies = []Enemy{
		{ID: "enemy-0", DefID: "goblin", DistanceTravelled: 0.5, HP: 1},
	}
	result := tickCombat(state, 1.0/30.0)
	// Enemy HP was 1; archer deals 8 damage → enemy is dead.
	if len(result.Enemies) != 0 {
		t.Errorf(
			"expected enemy killed, got %d enemies remaining",
			len(result.Enemies),
		)
	}
	if result.Gold != state.Gold+EnemyDefs["goblin"].Reward {
		t.Errorf(
			"gold: got %d, want %d",
			result.Gold,
			state.Gold+EnemyDefs["goblin"].Reward,
		)
	}
}

// --- helper ---

func firstBuildableCell(t *testing.T) (int, int) {
	t.Helper()
	for k := range starterBuildableCells {
		return k[0], k[1]
	}
	t.Fatal("no buildable cells found")
	return 0, 0
}
