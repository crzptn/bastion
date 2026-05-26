package http_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/joakimcarlsson/minmux/router"

	bhttp "github.com/JoakimCarlsson/bastion/internal/http"
	"github.com/JoakimCarlsson/bastion/internal/scores"
	"github.com/JoakimCarlsson/bastion/internal/users"
)

// --- fake scoresService ---

type fakeScoresSvc struct {
	created []*scores.Score
	topList []*scores.Score
}

func (f *fakeScoresSvc) Submit(
	_ context.Context,
	userID string,
	in scores.SubmitInput,
) (*scores.Score, error) {
	sc := &scores.Score{
		ID:          "score-" + userID,
		UserID:      userID,
		Username:    "testuser",
		WaveReached: in.WaveReached,
		BaseHPLeft:  in.BaseHPLeft,
		DurationMs:  in.DurationMs,
		Coop:        in.Coop,
		CreatedAt:   time.Now().UTC(),
	}
	f.created = append(f.created, sc)
	return sc, nil
}

func (f *fakeScoresSvc) Top(
	_ context.Context,
	limit int,
) ([]*scores.Score, error) {
	if limit > len(f.topList) {
		limit = len(f.topList)
	}
	return f.topList[:limit], nil
}

// newTestScoresHandler builds a router with only scores routes wired.
func newTestScoresHandler(svc *fakeScoresSvc, secret []byte) http.Handler {
	r := router.New()
	bhttp.NewHandlerWithScores(r, svc, secret)
	return r
}

// --- AC1: TestPostScores_Authenticated_Persists ---

func TestPostScores_Authenticated_Persists(t *testing.T) {
	secret := testJWTSecret
	svc := &fakeScoresSvc{}
	h := newTestScoresHandler(svc, secret)

	// Mint a valid token for user "uid-alice".
	token, err := users.IssueToken("uid-alice", "alice", secret, time.Hour)
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}

	body := `{"wave_reached":5,"base_hp_left":80,"duration_ms":90000,"coop":false}`
	rec := doRequestWithAuth(h, http.MethodPost, "/api/scores", body, token)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d want 201; body: %s", rec.Code, rec.Body)
	}

	var resp struct {
		ID          string    `json:"id"`
		UserID      string    `json:"user_id"`
		Username    string    `json:"username"`
		WaveReached int       `json:"wave_reached"`
		BaseHPLeft  int       `json:"base_hp_left"`
		DurationMs  int64     `json:"duration_ms"`
		Coop        bool      `json:"coop"`
		CreatedAt   time.Time `json:"created_at"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.ID == "" {
		t.Error("expected non-empty id")
	}
	if resp.UserID != "uid-alice" {
		t.Errorf("user_id: got %q, want %q", resp.UserID, "uid-alice")
	}
	if resp.WaveReached != 5 {
		t.Errorf("wave_reached: got %d, want 5", resp.WaveReached)
	}

	if len(svc.created) != 1 {
		t.Fatalf(
			"fake store received %d Submit calls, want 1",
			len(svc.created),
		)
	}
	if svc.created[0].UserID != "uid-alice" {
		t.Errorf(
			"stored UserID: got %q, want %q",
			svc.created[0].UserID,
			"uid-alice",
		)
	}
}

// --- AC2: TestGetLeaderboard_OrderedTopN ---

func TestGetLeaderboard_OrderedTopN(t *testing.T) {
	svc := &fakeScoresSvc{
		topList: []*scores.Score{
			{
				ID:          "s1",
				UserID:      "u1",
				Username:    "alice",
				WaveReached: 10,
				BaseHPLeft:  90,
				DurationMs:  5000,
				CreatedAt:   time.Now(),
			},
			{
				ID:          "s2",
				UserID:      "u2",
				Username:    "bob",
				WaveReached: 8,
				BaseHPLeft:  70,
				DurationMs:  6000,
				CreatedAt:   time.Now(),
			},
			{
				ID:          "s3",
				UserID:      "u3",
				Username:    "carol",
				WaveReached: 5,
				BaseHPLeft:  30,
				DurationMs:  9000,
				CreatedAt:   time.Now(),
			},
			{
				ID:          "s4",
				UserID:      "u4",
				Username:    "dave",
				WaveReached: 3,
				BaseHPLeft:  10,
				DurationMs:  12000,
				CreatedAt:   time.Now(),
			},
		},
	}
	h := newTestScoresHandler(svc, testJWTSecret)

	rec := doRequest(h, http.MethodGet, "/api/leaderboard?limit=3", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200; body: %s", rec.Code, rec.Body)
	}

	var resp []struct {
		ID          string `json:"id"`
		Username    string `json:"username"`
		WaveReached int    `json:"wave_reached"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if len(resp) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(resp))
	}
	// Assert actual wave_reached values, not just length.
	wantWaves := []int{10, 8, 5}
	for i, want := range wantWaves {
		if resp[i].WaveReached != want {
			t.Errorf(
				"entry[%d].wave_reached: got %d, want %d",
				i, resp[i].WaveReached, want,
			)
		}
	}
}

// --- AC3: TestPostScores_NoAuth_401 ---

func TestPostScores_NoAuth_401(t *testing.T) {
	svc := &fakeScoresSvc{}
	h := newTestScoresHandler(svc, testJWTSecret)

	body := `{"wave_reached":5,"base_hp_left":80,"duration_ms":90000,"coop":false}`
	rec := doRequest(h, http.MethodPost, "/api/scores", body)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status: got %d want 401; body: %s", rec.Code, rec.Body)
	}
	if len(svc.created) != 0 {
		t.Errorf("CreateScore was called %d times, want 0", len(svc.created))
	}
}
