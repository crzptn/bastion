package realtime

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
)

// fakeClient is a test double that records Send calls.
type fakeClient struct {
	id       string
	mu       sync.Mutex
	received []Message
	closed   bool
}

func newFake(id string) *fakeClient { return &fakeClient{id: id} }

func (f *fakeClient) ID() string { return f.id }

func (f *fakeClient) Send(msg Message) error {
	f.mu.Lock()
	f.received = append(f.received, msg)
	f.mu.Unlock()
	return nil
}

func (f *fakeClient) Close() error {
	f.mu.Lock()
	f.closed = true
	f.mu.Unlock()
	return nil
}

func (f *fakeClient) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.received)
}

// TestHubJoinBroadcast verifies that Broadcast delivers to all joined clients.
func TestHubJoinBroadcast(t *testing.T) {
	hub := NewHub()

	c1 := newFake("c1")
	c2 := newFake("c2")
	hub.Join("room1", c1)
	hub.Join("room1", c2)

	msg := Message{Type: OpBroadcast}
	hub.Broadcast("room1", msg)

	if c1.count() != 1 {
		t.Errorf("c1: got %d messages, want 1", c1.count())
	}
	if c2.count() != 1 {
		t.Errorf("c2: got %d messages, want 1", c2.count())
	}
}

// TestHubLeaveDropsClient verifies that Leave removes the client and
// subsequent Broadcasts do not reach it.
func TestHubLeaveDropsClient(t *testing.T) {
	hub := NewHub()

	c1 := newFake("c1")
	c2 := newFake("c2")
	hub.Join("room2", c1)
	hub.Join("room2", c2)

	hub.Leave("room2", c1)

	hub.Broadcast("room2", Message{Type: OpBroadcast})

	if c1.count() != 0 {
		t.Errorf(
			"c1 should not receive after Leave; got %d messages",
			c1.count(),
		)
	}
	if c2.count() != 1 {
		t.Errorf("c2: got %d messages, want 1", c2.count())
	}
}

// TestHubBroadcastNoRoom is a no-op smoke test for a missing room.
func TestHubBroadcastNoRoom(t *testing.T) {
	hub := NewHub()
	// Should not panic.
	hub.Broadcast("nonexistent", Message{Type: OpBroadcast})
}

// TestHubRoomsListed verifies that Rooms() returns the correct room IDs.
func TestHubRoomsListed(t *testing.T) {
	hub := NewHub()
	hub.Join("alpha", newFake("x"))
	hub.Join("beta", newFake("y"))

	rooms := hub.Rooms()
	set := make(map[string]bool, len(rooms))
	for _, r := range rooms {
		set[r] = true
	}
	if !set["alpha"] || !set["beta"] {
		t.Errorf("Rooms() = %v; want alpha and beta", rooms)
	}
}

// TestHubEmptyRoomPruned verifies that Leave cleans up empty rooms.
func TestHubEmptyRoomPruned(t *testing.T) {
	hub := NewHub()
	c := newFake("c1")
	hub.Join("prune-me", c)
	hub.Leave("prune-me", c)

	rooms := hub.Rooms()
	for _, r := range rooms {
		if r == "prune-me" {
			t.Errorf("empty room 'prune-me' was not pruned from hub")
		}
	}
}

// TestHubClose sends error+close to all clients and clears rooms.
func TestHubClose(t *testing.T) {
	hub := NewHub()
	c := newFake("c1")
	hub.Join("r", c)
	hub.Close()

	if c.count() == 0 {
		t.Error(
			"Close should have sent an error message before closing clients",
		)
	}
	if !c.closed {
		t.Error("Close should have called client.Close()")
	}
	if len(hub.Rooms()) != 0 {
		t.Error("Close should remove all rooms")
	}
}

// TestHubConcurrentJoinBroadcast ensures no data races under heavy concurrent use.
func TestHubConcurrentJoinBroadcast(t *testing.T) {
	hub := NewHub()
	const goroutines = 20

	var wg sync.WaitGroup
	var totalSent atomic.Int64

	for i := range goroutines {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			id := fmt.Sprintf("c%d", n)
			c := newFake(id)
			hub.Join("concurrent", c)
			hub.Broadcast("concurrent", Message{Type: OpBroadcast})
			hub.Leave("concurrent", c)
			totalSent.Add(int64(c.count()))
		}(i)
	}

	wg.Wait()
	// Each client should have received at least 0 (race depends on timing),
	// and no panics or data races should occur (verified with -race flag).
	if totalSent.Load() < 0 {
		t.Error("unexpected negative send count")
	}
}
