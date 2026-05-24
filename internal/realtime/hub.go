package realtime

import "sync"

// Hub manages a collection of rooms and provides the join/leave/broadcast API.
// It is safe for concurrent use.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]*room
}

// NewHub constructs an empty Hub.
func NewHub() *Hub {
	return &Hub{rooms: make(map[string]*room)}
}

// getOrCreate returns the room for roomID, creating it if it does not exist.
func (h *Hub) getOrCreate(roomID string) *room {
	h.mu.Lock()
	r, ok := h.rooms[roomID]
	if !ok {
		r = newRoom()
		h.rooms[roomID] = r
	}
	h.mu.Unlock()
	return r
}

// Join adds client c to the room identified by roomID.
func (h *Hub) Join(roomID string, c Client) {
	h.getOrCreate(roomID).add(c)
}

// Leave removes client c from the room identified by roomID.
// If the room becomes empty it is pruned from the hub.
func (h *Hub) Leave(roomID string, c Client) {
	h.mu.Lock()
	r, ok := h.rooms[roomID]
	h.mu.Unlock()
	if !ok {
		return
	}

	r.remove(c.ID())

	// Prune empty rooms to prevent unbounded memory growth.
	if r.size() == 0 {
		h.mu.Lock()
		// Re-check under write lock to avoid a race with a concurrent Join.
		if r.size() == 0 {
			delete(h.rooms, roomID)
		}
		h.mu.Unlock()
	}
}

// Broadcast sends msg to every client currently in roomID.
// If the room does not exist the call is a no-op.
func (h *Hub) Broadcast(roomID string, msg Message) {
	h.mu.RLock()
	r, ok := h.rooms[roomID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	r.broadcast(msg)
}

// Rooms returns the IDs of all active rooms.
func (h *Hub) Rooms() []string {
	h.mu.RLock()
	ids := make([]string, 0, len(h.rooms))
	for id := range h.rooms {
		ids = append(ids, id)
	}
	h.mu.RUnlock()
	return ids
}

// Close broadcasts an OpError message to every client in every room and
// removes all rooms. Callers should call Close during server shutdown.
func (h *Hub) Close() {
	h.mu.Lock()
	rooms := h.rooms
	h.rooms = make(map[string]*room)
	h.mu.Unlock()

	errMsg := Message{Type: OpError, Version: ProtocolVersion}
	for _, r := range rooms {
		for _, c := range r.snapshot() {
			_ = c.Send(errMsg)
			_ = c.Close()
		}
	}
}
