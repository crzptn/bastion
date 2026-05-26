package http

import (
	"encoding/json"
	"net/http"

	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/session"
)

// registerSession mounts the session REST endpoints.
//
//	GET /api/sessions/{id}/snapshot → 200 snapshotPayload | 404
func registerSession(r *router.Router, mgr *session.Manager) {
	r.HandleFunc(
		http.MethodGet,
		"/api/sessions/{id}/snapshot",
		func(w http.ResponseWriter, req *http.Request) {
			id := req.PathValue("id")
			if id == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"error":"session id required"}`))
				return
			}

			state, ok := mgr.Snapshot(id)
			if !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write([]byte(`{"error":"session_not_found"}`))
				return
			}

			type resp struct {
				ID        string          `json:"id"`
				Gold      int             `json:"gold"`
				BaseHP    int             `json:"base_hp"`
				WaveIndex int             `json:"wave_index"`
				Phase     string          `json:"phase"`
				Towers    []session.Tower `json:"towers"`
				Enemies   []session.Enemy `json:"enemies"`
				Tick      uint64          `json:"tick"`
			}

			towers := state.Towers
			if towers == nil {
				towers = []session.Tower{}
			}
			enemies := state.Enemies
			if enemies == nil {
				enemies = []session.Enemy{}
			}

			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp{
				ID:        id,
				Gold:      state.Gold,
				BaseHP:    state.BaseHP,
				WaveIndex: state.WaveIndex,
				Phase:     state.Phase,
				Towers:    towers,
				Enemies:   enemies,
				Tick:      state.Tick,
			})
		},
	)
}
