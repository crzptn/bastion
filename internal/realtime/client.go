package realtime

// Client represents a connected WebSocket peer.
// Implementations live in the HTTP adapter layer; this interface keeps the
// domain package free of net/http / websocket imports.
type Client interface {
	// ID returns a unique identifier for this connection.
	ID() string

	// Send delivers a message to the client. Returns an error if the
	// underlying write fails; callers should treat a write error as a
	// disconnection signal.
	Send(msg Message) error

	// Close tears down the connection. Idempotent; safe to call multiple times.
	Close() error
}
