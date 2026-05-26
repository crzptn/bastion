package session

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/JoakimCarlsson/bastion/internal/realtime"
)

const (
	// tickRate is the fixed simulation step — 30 ticks per second.
	tickRate = 30
	// tickInterval is the wall-clock duration of one tick.
	tickInterval = time.Second / tickRate
)

// ErrSessionNotFound is returned when an operation targets an unknown session ID.
var ErrSessionNotFound = errors.New("session: not found")

// ErrSessionAlreadyRunning is returned when Start is called on an existing session.
var ErrSessionAlreadyRunning = errors.New("session: already running")

// session holds the live state for one multiplayer game.
type session struct {
	id        string
	state     RunState
	mu        sync.Mutex
	intents   chan Intent
	cancel    context.CancelFunc
	done      chan struct{}
	playerIDs []string
}

// Manager owns all running sessions. It is safe for concurrent use.
type Manager struct {
	mu          sync.RWMutex
	sessions    map[string]*session
	broadcaster func(sessionID string, msg realtime.Message)
}

// NewManager constructs an empty Manager.
func NewManager() *Manager {
	return &Manager{
		sessions: make(map[string]*session),
	}
}

// SetBroadcaster installs the fan-out function. It must be called before Start.
// The broadcaster is called on every tick from the session goroutine with the
// current RunState snapshot wrapped in an OpStateSnapshot message.
func (m *Manager) SetBroadcaster(
	b func(sessionID string, msg realtime.Message),
) {
	m.mu.Lock()
	m.broadcaster = b
	m.mu.Unlock()
}

// Start creates a new session with the given ID and player list and launches
// its tick loop. Returns ErrSessionAlreadyRunning if the ID is already active.
func (m *Manager) Start(sessionID string, playerIDs []string) error {
	m.mu.Lock()
	if _, exists := m.sessions[sessionID]; exists {
		m.mu.Unlock()
		return ErrSessionAlreadyRunning
	}

	ctx, cancel := context.WithCancel(context.Background())
	sess := &session{
		id:        sessionID,
		state:     createInitialRunState(),
		intents:   make(chan Intent, 64),
		cancel:    cancel,
		done:      make(chan struct{}),
		playerIDs: playerIDs,
	}
	m.sessions[sessionID] = sess
	m.mu.Unlock()

	go m.runSession(ctx, sess)
	return nil
}

// Stop cancels a running session and waits for its goroutine to exit.
func (m *Manager) Stop(sessionID string) {
	m.mu.RLock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()
	if !ok {
		return
	}
	sess.cancel()
	<-sess.done

	m.mu.Lock()
	delete(m.sessions, sessionID)
	m.mu.Unlock()
}

// Submit enqueues an intent for the given session. Returns ErrSessionNotFound
// if the session does not exist.
func (m *Manager) Submit(sessionID string, intent Intent) error {
	m.mu.RLock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()
	if !ok {
		return ErrSessionNotFound
	}
	select {
	case sess.intents <- intent:
	default:
		// Drop if buffer full — intent loss is acceptable for M3.
	}
	return nil
}

// Snapshot returns a copy of the current RunState for the given session.
// The second return value is false if the session does not exist.
func (m *Manager) Snapshot(sessionID string) (RunState, bool) {
	m.mu.RLock()
	sess, ok := m.sessions[sessionID]
	m.mu.RUnlock()
	if !ok {
		return RunState{}, false
	}
	sess.mu.Lock()
	snap := sess.state
	sess.mu.Unlock()
	return snap, true
}

// Close stops all running sessions and blocks until they exit.
func (m *Manager) Close() {
	m.mu.Lock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.Unlock()

	for _, id := range ids {
		m.Stop(id)
	}
}

// runSession drives the fixed-step tick loop for one session.
func (m *Manager) runSession(ctx context.Context, sess *session) {
	defer close(sess.done)

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	const dt = 1.0 / float64(tickRate)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Drain all pending intents before the tick.
			sess.mu.Lock()
			state := sess.state
			sess.mu.Unlock()

		drainIntents:
			for {
				select {
				case intent := <-sess.intents:
					state = m.applyIntent(state, intent)
				default:
					break drainIntents
				}
			}

			// Advance the simulation by one tick.
			prevPhase := state.Phase
			state = tickWaves(state, dt)
			state = tickEnemies(state, dt)
			state = tickCombat(state, dt)
			state.Tick++

			// Detect phase change.
			phaseChanged := state.Phase != prevPhase

			sess.mu.Lock()
			sess.state = state
			sess.mu.Unlock()

			m.mu.RLock()
			broadcaster := m.broadcaster
			m.mu.RUnlock()

			if broadcaster == nil {
				continue
			}

			// Broadcast periodic snapshot (AC4).
			snap := buildSnapshotMessage(sess.id, state)
			broadcaster(sess.id, snap)

			// Broadcast phase change if transition occurred.
			if phaseChanged {
				broadcaster(
					sess.id,
					buildPhaseChangeMessage(prevPhase, state.Phase),
				)
			}
		}
	}
}

// applyIntent validates and applies one Intent to the current state.
func (m *Manager) applyIntent(state RunState, intent Intent) RunState {
	switch intent.Kind {
	case IntentKindPlaceTower:
		newState, placed := placeTower(state, intent.DefID, intent.X, intent.Y)
		if placed {
			return newState
		}
	case IntentKindStartWave:
		return applyStartWave(state)
	}
	return state
}

// buildSnapshotMessage serialises the current RunState into a Message.
func buildSnapshotMessage(sessionID string, state RunState) realtime.Message {
	// Encode state inline using json.Marshal-compatible encoding.
	// We use the session package's own types which are json-tagged.
	payload := encodeStatePayload(sessionID, state)
	return realtime.Message{
		Type:    realtime.OpStateSnapshot,
		Payload: payload,
		Version: realtime.ProtocolVersion,
	}
}

// buildPhaseChangeMessage emits a phase_change notification.
func buildPhaseChangeMessage(from, to string) realtime.Message {
	payload := encodePhaseChangePayload(from, to)
	return realtime.Message{
		Type:    realtime.OpPhaseChange,
		Payload: payload,
		Version: realtime.ProtocolVersion,
	}
}
