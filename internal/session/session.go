// Package session owns RunState, the fixed-step tick loop, and the session
// manager for server-authoritative co-op multiplayer.
//
// # Session resource model
//
// Gold, BaseHP, and lives are a single shared pool per session. There is no
// per-player accounting. Every snapshot broadcasts the same values to all
// subscribers of the session room.
//
// Intents submitted with a PlayerID that is not in the session's playerIDs
// slice are silently dropped before any state mutation occurs. An empty
// PlayerID is also rejected. This ensures that only the two registered
// co-op players can affect the shared pool.
//
// No net/http imports — this is a pure domain package.
package session

// Phase constants mirror the client-side GamePhase union in web/src/game/types.ts.
const (
	PhasePrep     = "prep"
	PhaseCombat   = "combat"
	PhaseGameover = "gameover"
	PhaseVictory  = "victory"
)

// Tower is the server-side representation of a placed tower instance.
type Tower struct {
	ID                string  `json:"id"`
	DefID             string  `json:"def_id"`
	X                 int     `json:"x"`
	Y                 int     `json:"y"`
	CooldownRemaining float64 `json:"cooldown_remaining"`
}

// Enemy is the server-side representation of a live enemy on the board.
type Enemy struct {
	ID                string  `json:"id"`
	DefID             string  `json:"def_id"`
	DistanceTravelled float64 `json:"distance_travelled"`
	HP                int     `json:"hp"`
}

// WaveProgress tracks the state of the currently active wave spawn queue.
type WaveProgress struct {
	SpawnQueue         []PendingSpawn `json:"spawn_queue"`
	TimeUntilNextSpawn float64        `json:"time_until_next_spawn"`
}

// PendingSpawn is one group inside a WaveProgress spawn queue.
type PendingSpawn struct {
	DefID     string  `json:"def_id"`
	Remaining int     `json:"remaining"`
	Interval  float64 `json:"interval"`
}

// RunState is the authoritative, serialisable game state for one session.
// The server is the sole writer; clients receive snapshots and submit Intents.
type RunState struct {
	Gold         int           `json:"gold"`
	BaseHP       int           `json:"base_hp"`
	WaveIndex    int           `json:"wave_index"`
	Phase        string        `json:"phase"`
	Towers       []Tower       `json:"towers"`
	Enemies      []Enemy       `json:"enemies"`
	WaveProgress *WaveProgress `json:"wave_progress,omitempty"`
	NextEnemyID  int           `json:"next_enemy_id"`
	Tick         uint64        `json:"tick"`
}

// Intent is a client-submitted action request. The server validates and
// applies it; clients have no write access to RunState directly.
//
// kind values: "place_tower" | "start_wave"
type Intent struct {
	Kind     string `json:"kind"`
	PlayerID string `json:"player_id"`
	DefID    string `json:"def_id,omitempty"`
	X        int    `json:"x,omitempty"`
	Y        int    `json:"y,omitempty"`
}

// IntentKindPlaceTower and IntentKindStartWave are the supported intent kinds.
const (
	IntentKindPlaceTower = "place_tower"
	IntentKindStartWave  = "start_wave"
)

// isMember reports whether playerID is in the session's registered player list.
// An empty playerID is never a member.
func (s *session) isMember(playerID string) bool {
	if playerID == "" {
		return false
	}
	for _, id := range s.playerIDs {
		if id == playerID {
			return true
		}
	}
	return false
}

// createInitialRunState returns the default RunState for a new session,
// matching createInitialRunState() in web/src/game/constants.ts.
func createInitialRunState() RunState {
	return RunState{
		Gold:         100,
		BaseHP:       20,
		WaveIndex:    0,
		Phase:        PhasePrep,
		Towers:       []Tower{},
		Enemies:      []Enemy{},
		WaveProgress: nil,
		NextEnemyID:  0,
		Tick:         0,
	}
}
