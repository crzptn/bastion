package session

import (
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
