package realtime

import "sync"

// room holds all clients currently subscribed to a named room.
// All mutations are protected by mu; fan-out happens on a snapshot
// so the lock is not held during Send calls.
type room struct {
	mu      sync.RWMutex
	clients map[string]Client
}

func newRoom() *room {
	return &room{clients: make(map[string]Client)}
}

// add registers a client. Idempotent for the same ID.
func (r *room) add(c Client) {
	r.mu.Lock()
	r.clients[c.ID()] = c
	r.mu.Unlock()
}

// remove unregisters a client by ID.
func (r *room) remove(id string) {
	r.mu.Lock()
	delete(r.clients, id)
	r.mu.Unlock()
}

// size returns the number of connected clients.
func (r *room) size() int {
	r.mu.RLock()
	n := len(r.clients)
	r.mu.RUnlock()
	return n
}

// snapshot returns a stable copy of current clients (no lock held during iteration).
func (r *room) snapshot() []Client {
	r.mu.RLock()
	out := make([]Client, 0, len(r.clients))
	for _, c := range r.clients {
		out = append(out, c)
	}
	r.mu.RUnlock()
	return out
}

// broadcast sends msg to every client in the room. Send errors are silently
// dropped — the read-side goroutine handles disconnection.
func (r *room) broadcast(msg Message) {
	for _, c := range r.snapshot() {
		_ = c.Send(msg)
	}
}
