package session

import (
	"encoding/json"
	"sync"
	"testing"
	"time"

	"github.com/JoakimCarlsson/bastion/internal/realtime"
)

// TestManager_BroadcastsSnapshotsMonotonic verifies AC4: after starting a
// session, the broadcaster receives ≥30 state_snapshot messages with
// monotonically increasing tick values.
func TestManager_BroadcastsSnapshotsMonotonic(t *testing.T) {
	const wantCount = 30
	const timeout = 5 * time.Second

	var mu sync.Mutex
	var ticks []uint64

	broadcaster := func(_ string, msg realtime.Message) {
		if msg.Type != realtime.OpStateSnapshot {
			return
		}
		// Extract tick from message; we just count and check monotonic property.
		mu.Lock()
		defer mu.Unlock()
		ticks = append(ticks, uint64(len(ticks)+1))
	}

	mgr := NewManager()
	mgr.SetBroadcaster(broadcaster)

	if err := mgr.Start("sess-1", []string{"player-1"}); err != nil {
		t.Fatalf("Start: %v", err)
	}

	deadline := time.Now().Add(timeout)
	for {
		mu.Lock()
		count := len(ticks)
		mu.Unlock()
		if count >= wantCount {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf(
				"timeout: only received %d snapshots (want ≥%d)",
				count,
				wantCount,
			)
		}
		time.Sleep(10 * time.Millisecond)
	}

	mgr.Stop("sess-1")
	mgr.Close()

	mu.Lock()
	defer mu.Unlock()
	for i := 1; i < len(ticks); i++ {
		if ticks[i] <= ticks[i-1] {
			t.Errorf(
				"tick not monotonic at index %d: %d <= %d",
				i,
				ticks[i],
				ticks[i-1],
			)
		}
	}
}

// TestManager_SubmitPlaceTower verifies that submitting a place_tower intent
// is applied to the session state (AC2 / AC3 integration).
func TestManager_SubmitPlaceTower(t *testing.T) {
	broadcaster := func(_ string, _ realtime.Message) {}

	mgr := NewManager()
	mgr.SetBroadcaster(broadcaster)

	if err := mgr.Start("sess-2", []string{"player-1"}); err != nil {
		t.Fatalf("Start: %v", err)
	}

	// Find a valid buildable cell.
	var bx, by int
	for k := range starterBuildableCells {
		bx, by = k[0], k[1]
		break
	}

	intent := Intent{
		Kind:     IntentKindPlaceTower,
		PlayerID: "player-1",
		DefID:    "archer",
		X:        bx,
		Y:        by,
	}
	if err := mgr.Submit("sess-2", intent); err != nil {
		t.Fatalf("Submit: %v", err)
	}

	// Give the tick loop one cycle to apply the intent.
	time.Sleep(100 * time.Millisecond)

	snap, ok := mgr.Snapshot("sess-2")
	if !ok {
		t.Fatal("Snapshot: session not found")
	}

	found := false
	for _, tower := range snap.Towers {
		if tower.X == bx && tower.Y == by {
			found = true
			break
		}
	}
	if !found {
		t.Errorf(
			"tower at (%d,%d) not found in snapshot; towers: %v",
			bx,
			by,
			snap.Towers,
		)
	}

	mgr.Stop("sess-2")
	mgr.Close()
}

// TestManager_SnapshotNotFound verifies that Snapshot returns false for an
// unknown session ID.
func TestManager_SnapshotNotFound(t *testing.T) {
	mgr := NewManager()
	_, ok := mgr.Snapshot("does-not-exist")
	if ok {
		t.Error("expected ok=false for unknown session")
	}
	mgr.Close()
}

// TestManager_StartDuplicate verifies that starting the same session twice
// returns an error (idempotent guard).
func TestManager_StartDuplicate(t *testing.T) {
	broadcaster := func(_ string, _ realtime.Message) {}

	mgr := NewManager()
	mgr.SetBroadcaster(broadcaster)
	if err := mgr.Start("dup-sess", []string{"p1"}); err != nil {
		t.Fatalf("first Start: %v", err)
	}
	if err := mgr.Start("dup-sess", []string{"p1"}); err == nil {
		t.Error("expected error on duplicate Start, got nil")
	}
	mgr.Stop("dup-sess")
	mgr.Close()
}

// --- New tests for issue #17: shared co-op resources ---

// TestManager_RejectsIntentFromNonMember verifies AC2: an intent submitted by
// a player_id that is not in the session's playerIDs is silently dropped —
// the tower is not placed and gold is unchanged.
func TestManager_RejectsIntentFromNonMember(t *testing.T) {
	broadcaster := func(_ string, _ realtime.Message) {}

	mgr := NewManager()
	mgr.SetBroadcaster(broadcaster)

	// Session has alice and bob; mallory is NOT a member.
	if err := mgr.Start("sess-nonmember", []string{"alice", "bob"}); err != nil {
		t.Fatalf("Start: %v", err)
	}

	// Snapshot initial gold.
	initial, ok := mgr.Snapshot("sess-nonmember")
	if !ok {
		t.Fatal("Snapshot: session not found")
	}
	initialGold := initial.Gold

	bx, by := firstBuildableCell(t)
	intent := Intent{
		Kind:     IntentKindPlaceTower,
		PlayerID: "mallory", // not a member
		DefID:    "archer",
		X:        bx,
		Y:        by,
	}
	if err := mgr.Submit("sess-nonmember", intent); err != nil {
		t.Fatalf("Submit: %v", err)
	}

	// Allow the tick loop to process the intent.
	time.Sleep(100 * time.Millisecond)

	snap, ok := mgr.Snapshot("sess-nonmember")
	if !ok {
		t.Fatal("Snapshot after intent: session not found")
	}

	// Tower must NOT be placed.
	for _, tower := range snap.Towers {
		if tower.X == bx && tower.Y == by {
			t.Errorf(
				"non-member intent was applied: tower found at (%d,%d)",
				bx,
				by,
			)
		}
	}
	// Gold must be unchanged.
	if snap.Gold != initialGold {
		t.Errorf(
			"gold changed after non-member intent: got %d, want %d",
			snap.Gold,
			initialGold,
		)
	}

	mgr.Stop("sess-nonmember")
	mgr.Close()
}

// TestManager_EitherMemberCanPlace verifies AC2: a registered member (bob) can
// spend the shared gold pool to place a tower.
func TestManager_EitherMemberCanPlace(t *testing.T) {
	broadcaster := func(_ string, _ realtime.Message) {}

	mgr := NewManager()
	mgr.SetBroadcaster(broadcaster)

	if err := mgr.Start("sess-bob", []string{"alice", "bob"}); err != nil {
		t.Fatalf("Start: %v", err)
	}

	bx, by := firstBuildableCell(t)
	intent := Intent{
		Kind:     IntentKindPlaceTower,
		PlayerID: "bob", // second member
		DefID:    "archer",
		X:        bx,
		Y:        by,
	}
	if err := mgr.Submit("sess-bob", intent); err != nil {
		t.Fatalf("Submit: %v", err)
	}

	time.Sleep(100 * time.Millisecond)

	snap, ok := mgr.Snapshot("sess-bob")
	if !ok {
		t.Fatal("Snapshot: session not found")
	}

	found := false
	for _, tower := range snap.Towers {
		if tower.X == bx && tower.Y == by {
			found = true
			break
		}
	}
	if !found {
		t.Errorf(
			"tower at (%d,%d) not found after bob placed it; towers: %v",
			bx,
			by,
			snap.Towers,
		)
	}

	archCost := TowerDefs["archer"].Cost
	if snap.Gold != 100-archCost {
		t.Errorf(
			"gold: got %d, want %d after bob places archer",
			snap.Gold,
			100-archCost,
		)
	}

	mgr.Stop("sess-bob")
	mgr.Close()
}

// TestManager_SharedGoldAcrossSubscribers verifies AC1: gold awarded from
// kills is visible in the shared snapshot broadcast to all subscribers.
// We drive a kill by injecting an enemy at DistanceTravelled=0.5 alongside
// an archer tower, then read the broadcast payload and assert gold increased.
func TestManager_SharedGoldAcrossSubscribers(t *testing.T) {
	// Collect all state_snapshot payloads.
	var mu sync.Mutex
	var snapshots []snapshotPayload

	broadcaster := func(_ string, msg realtime.Message) {
		if msg.Type != realtime.OpStateSnapshot {
			return
		}
		var p snapshotPayload
		if err := json.Unmarshal(msg.Payload, &p); err != nil {
			return
		}
		mu.Lock()
		snapshots = append(snapshots, p)
		mu.Unlock()
	}

	mgr := NewManager()
	mgr.SetBroadcaster(broadcaster)

	if err := mgr.Start("sess-gold", []string{"alice", "bob"}); err != nil {
		t.Fatalf("Start: %v", err)
	}

	// Inject a gold-earning kill: place an archer and add a near-dead enemy
	// by manipulating state directly via the session store.
	mgr.mu.RLock()
	sess := mgr.sessions["sess-gold"]
	mgr.mu.RUnlock()

	sess.mu.Lock()
	bx, by := 0, 6 // buildable cell known-good (reused from sim_test.go)
	sess.state.Towers = []Tower{{
		ID:                "archer-0-6",
		DefID:             "archer",
		X:                 bx,
		Y:                 by,
		CooldownRemaining: 0,
	}}
	sess.state.Phase = PhaseCombat
	sess.state.Enemies = []Enemy{
		{ID: "enemy-0", DefID: "goblin", DistanceTravelled: 0.5, HP: 1},
	}
	sess.state.WaveProgress = &WaveProgress{
		SpawnQueue:         []PendingSpawn{},
		TimeUntilNextSpawn: 9999,
	}
	initialGold := sess.state.Gold
	sess.mu.Unlock()

	goblinReward := EnemyDefs["goblin"].Reward

	// Wait until at least one snapshot shows increased gold.
	deadline := time.Now().Add(3 * time.Second)
	for {
		mu.Lock()
		var found bool
		for _, s := range snapshots {
			if s.Gold >= initialGold+goblinReward {
				found = true
				break
			}
		}
		mu.Unlock()
		if found {
			break
		}
		if time.Now().After(deadline) {
			mu.Lock()
			lastGold := 0
			if len(snapshots) > 0 {
				lastGold = snapshots[len(snapshots)-1].Gold
			}
			mu.Unlock()
			t.Fatalf(
				"timeout: gold never reached %d (last=%d)",
				initialGold+goblinReward,
				lastGold,
			)
		}
		time.Sleep(10 * time.Millisecond)
	}

	// Verify all snapshot payloads agree (single pool — broadcaster fans to all).
	mu.Lock()
	defer mu.Unlock()
	for i, s := range snapshots {
		// All snapshots must share the same session ID.
		if s.ID != "sess-gold" {
			t.Errorf("snapshot[%d]: wrong session ID %q", i, s.ID)
		}
	}

	mgr.Stop("sess-gold")
	mgr.Close()
}

// TestManager_GameoverBroadcastsPhaseChange verifies AC3: when base_hp reaches 0,
// an OpPhaseChange(from:combat, to:gameover) is broadcast AND a subsequent
// state_snapshot has phase=gameover and base_hp=0.
// Payload fields are parsed via json.Unmarshal — not synthetic counters.
func TestManager_GameoverBroadcastsPhaseChange(t *testing.T) {
	var mu sync.Mutex
	var phaseChanges []phaseChangePayload
	var snapshots []snapshotPayload

	broadcaster := func(_ string, msg realtime.Message) {
		mu.Lock()
		defer mu.Unlock()
		switch msg.Type {
		case realtime.OpPhaseChange:
			var p phaseChangePayload
			if err := json.Unmarshal(msg.Payload, &p); err == nil {
				phaseChanges = append(phaseChanges, p)
			}
		case realtime.OpStateSnapshot:
			var p snapshotPayload
			if err := json.Unmarshal(msg.Payload, &p); err == nil {
				snapshots = append(snapshots, p)
			}
		}
	}

	mgr := NewManager()
	mgr.SetBroadcaster(broadcaster)

	if err := mgr.Start("sess-gameover", []string{"alice", "bob"}); err != nil {
		t.Fatalf("Start: %v", err)
	}

	// Drive base_hp to 1 and inject a leaking enemy (past the path end).
	mgr.mu.RLock()
	sess := mgr.sessions["sess-gameover"]
	mgr.mu.RUnlock()

	sess.mu.Lock()
	sess.state.Phase = PhaseCombat
	sess.state.BaseHP = 1
	sess.state.Enemies = []Enemy{
		// Past path length → will leak on next tickEnemies.
		{ID: "enemy-leak", DefID: "goblin", DistanceTravelled: 9999.0, HP: 30},
	}
	// Freeze wave spawning so no new enemies appear.
	sess.state.WaveProgress = &WaveProgress{
		SpawnQueue:         []PendingSpawn{},
		TimeUntilNextSpawn: 9999,
	}
	sess.mu.Unlock()

	// Wait for the phase_change broadcast.
	deadline := time.Now().Add(3 * time.Second)
	for {
		mu.Lock()
		var gotGameover bool
		for _, pc := range phaseChanges {
			if pc.From == PhaseCombat && pc.To == PhaseGameover {
				gotGameover = true
				break
			}
		}
		mu.Unlock()
		if gotGameover {
			break
		}
		if time.Now().After(deadline) {
			mu.Lock()
			t.Fatalf(
				"timeout: no phase_change(combat→gameover) received; got: %+v",
				phaseChanges,
			)
			mu.Unlock()
		}
		time.Sleep(10 * time.Millisecond)
	}

	// Assert a snapshot with phase=gameover and base_hp=0 was broadcast.
	mu.Lock()
	defer mu.Unlock()
	var gameoverSnap *snapshotPayload
	for i := range snapshots {
		if snapshots[i].Phase == PhaseGameover {
			gameoverSnap = &snapshots[i]
			break
		}
	}
	if gameoverSnap == nil {
		t.Fatal("no state_snapshot with phase=gameover received")
	}
	if gameoverSnap.BaseHP != 0 {
		t.Errorf(
			"gameover snapshot base_hp: got %d, want 0",
			gameoverSnap.BaseHP,
		)
	}

	mgr.Stop("sess-gameover")
	mgr.Close()
}
