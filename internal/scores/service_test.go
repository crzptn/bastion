package scores

import (
	"context"
	"testing"
	"time"
)

// --- fake store ---

type fakeStore struct {
	created []*Score
	topList []*Score
}

func (f *fakeStore) CreateScore(_ context.Context, s *Score) error {
	cp := *s
	f.created = append(f.created, &cp)
	return nil
}

func (f *fakeStore) TopScores(_ context.Context, limit int) ([]*Score, error) {
	if limit > len(f.topList) {
		limit = len(f.topList)
	}
	return f.topList[:limit], nil
}

// --- AC1: TestService_Submit_StoresValidPayload ---

func TestService_Submit_StoresValidPayload(t *testing.T) {
	store := &fakeStore{}
	svc := NewService(store)

	in := SubmitInput{
		WaveReached: 7,
		BaseHPLeft:  50,
		DurationMs:  120000,
		Coop:        true,
	}

	score, err := svc.Submit(context.Background(), "user-abc", in)
	if err != nil {
		t.Fatalf("Submit: unexpected error: %v", err)
	}

	if score.ID == "" {
		t.Error("expected non-empty ID")
	}
	if score.UserID != "user-abc" {
		t.Errorf("UserID: got %q, want %q", score.UserID, "user-abc")
	}
	if score.WaveReached != 7 {
		t.Errorf("WaveReached: got %d, want 7", score.WaveReached)
	}
	if score.BaseHPLeft != 50 {
		t.Errorf("BaseHPLeft: got %d, want 50", score.BaseHPLeft)
	}
	if score.DurationMs != 120000 {
		t.Errorf("DurationMs: got %d, want 120000", score.DurationMs)
	}
	if !score.Coop {
		t.Error("Coop: got false, want true")
	}
	if score.CreatedAt.IsZero() {
		t.Error("CreatedAt must be non-zero")
	}
	if time.Since(score.CreatedAt) > 5*time.Second {
		t.Errorf("CreatedAt looks stale: %v", score.CreatedAt)
	}

	if len(store.created) != 1 {
		t.Fatalf(
			"fake store received %d CreateScore calls, want 1",
			len(store.created),
		)
	}
	if store.created[0].ID != score.ID {
		t.Error("stored ID does not match returned ID")
	}
}

// --- AC2: TestService_Top_ClampsLimit ---

func TestService_Top_ClampsLimit(t *testing.T) {
	// Build a fake store with 150 pre-sorted entries.
	store := &fakeStore{}
	for i := 0; i < 150; i++ {
		store.topList = append(store.topList, &Score{
			ID:          "id",
			WaveReached: 150 - i,
		})
	}
	svc := NewService(store)

	cases := []struct {
		input     int
		wantLimit int
	}{
		{0, 10},
		{500, 100},
		{5, 5},
	}

	for _, tc := range cases {
		results, err := svc.Top(context.Background(), tc.input)
		if err != nil {
			t.Fatalf("Top(%d): unexpected error: %v", tc.input, err)
		}
		if len(results) != tc.wantLimit {
			t.Errorf(
				"Top(%d): got %d results, want %d",
				tc.input, len(results), tc.wantLimit,
			)
		}
	}
}
