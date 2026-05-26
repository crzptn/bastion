package session

import (
	"encoding/json"

	"github.com/JoakimCarlsson/bastion/internal/realtime"
)

// snapshotPayload is the JSON payload for an OpStateSnapshot message.
type snapshotPayload struct {
	ID           string        `json:"id"`
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

// encodeStatePayload marshals the RunState into a json.RawMessage.
// On marshalling errors the payload is set to null (should not happen in practice).
func encodeStatePayload(sessionID string, state RunState) json.RawMessage {
	towers := state.Towers
	if towers == nil {
		towers = []Tower{}
	}
	enemies := state.Enemies
	if enemies == nil {
		enemies = []Enemy{}
	}
	p := snapshotPayload{
		ID:           sessionID,
		Gold:         state.Gold,
		BaseHP:       state.BaseHP,
		WaveIndex:    state.WaveIndex,
		Phase:        state.Phase,
		Towers:       towers,
		Enemies:      enemies,
		WaveProgress: state.WaveProgress,
		NextEnemyID:  state.NextEnemyID,
		Tick:         state.Tick,
	}
	b, err := json.Marshal(p)
	if err != nil {
		return json.RawMessage("null")
	}
	return b
}

// phaseChangePayload is the JSON payload for an OpPhaseChange message.
type phaseChangePayload struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// encodePhaseChangePayload marshals a from/to phase pair.
func encodePhaseChangePayload(from, to string) json.RawMessage {
	b, err := json.Marshal(phaseChangePayload{From: from, To: to})
	if err != nil {
		return json.RawMessage("null")
	}
	return b
}

// DecodeIntent parses a json.RawMessage into an Intent.
// Used by the HTTP layer when handling OpPlayerAction frames.
func DecodeIntent(data json.RawMessage) (Intent, error) {
	var intent Intent
	if err := json.Unmarshal(data, &intent); err != nil {
		return Intent{}, err
	}
	return intent, nil
}

// NewSnapshotMessage is a convenience constructor for tests and HTTP handlers.
func NewSnapshotMessage(sessionID string, state RunState) realtime.Message {
	return realtime.Message{
		Type:    realtime.OpStateSnapshot,
		Payload: encodeStatePayload(sessionID, state),
		Version: realtime.ProtocolVersion,
	}
}
