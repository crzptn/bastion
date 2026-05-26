package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/scores"
	"github.com/JoakimCarlsson/bastion/internal/users"
)

// scoresService is the interface this package requires from the scores domain.
type scoresService interface {
	Submit(
		ctx context.Context,
		userID string,
		in scores.SubmitInput,
	) (*scores.Score, error)
	Top(ctx context.Context, limit int) ([]*scores.Score, error)
}

// ---- DTOs ----

type submitScoreBody struct {
	WaveReached int   `json:"wave_reached"`
	BaseHPLeft  int   `json:"base_hp_left"`
	DurationMs  int64 `json:"duration_ms"`
	Coop        bool  `json:"coop"`
}

type scoreDTO struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Username    string    `json:"username"`
	WaveReached int       `json:"wave_reached"`
	BaseHPLeft  int       `json:"base_hp_left"`
	DurationMs  int64     `json:"duration_ms"`
	Coop        bool      `json:"coop"`
	CreatedAt   time.Time `json:"created_at"`
}

// leaderboardEntryDTO is the public shape of a leaderboard row.
type leaderboardEntryDTO = scoreDTO

// registerScores mounts the scores routes on r using HandleFunc so that
// the POST route can be protected with a middleware chain.
func registerScores(r *router.Router, svc scoresService, secret []byte) {
	// POST /api/scores — authenticated.
	r.HandleFunc(
		http.MethodPost,
		"/api/scores",
		func(w http.ResponseWriter, req *http.Request) {
			// Auth gate: parse Bearer token.
			claims := extractClaims(req, secret)
			if claims == nil {
				jsonResponse(
					w,
					http.StatusUnauthorized,
					errorResponse{Error: "unauthorized"},
				)
				return
			}

			var body submitScoreBody
			if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
				jsonResponse(
					w,
					http.StatusBadRequest,
					errorResponse{Error: "invalid_input"},
				)
				return
			}

			sc, err := svc.Submit(
				req.Context(),
				claims.UserID,
				scores.SubmitInput{
					WaveReached: body.WaveReached,
					BaseHPLeft:  body.BaseHPLeft,
					DurationMs:  body.DurationMs,
					Coop:        body.Coop,
				},
			)
			if err != nil {
				jsonResponse(
					w,
					http.StatusInternalServerError,
					errorResponse{Error: "internal_error"},
				)
				return
			}
			// Populate username from JWT claims — the store does not JOIN
			// back to users on insert.
			sc.Username = claims.Username
			jsonResponse(w, http.StatusCreated, toScoreDTO(sc))
		},
	)

	// GET /api/leaderboard — public.
	r.Get("/api/leaderboard", func(c *router.Context) {
		limit := 10
		if q := c.Request.URL.Query().Get("limit"); q != "" {
			n, err := strconv.Atoi(q)
			if err == nil {
				limit = n
			}
		}

		list, err := svc.Top(c.Ctx(), limit)
		if err != nil {
			c.JSON(
				http.StatusInternalServerError,
				errorResponse{Error: "internal_error"},
			)
			return
		}

		dtos := make([]leaderboardEntryDTO, 0, len(list))
		for _, sc := range list {
			dtos = append(dtos, toScoreDTO(sc))
		}
		c.JSON(http.StatusOK, dtos)
	})
}

// NewHandlerWithScores builds a router containing only the scores routes.
// Intended for unit tests in internal/http.
func NewHandlerWithScores(
	r *router.Router,
	svc scoresService,
	secret []byte,
) http.Handler {
	registerScores(r, svc, secret)
	return r
}

// extractClaims parses the Bearer JWT from the Authorization header.
// Returns nil when the header is absent or the token is invalid.
func extractClaims(req *http.Request, secret []byte) *users.Claims {
	authHeader := req.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(authHeader) < len(prefix) ||
		!strings.EqualFold(authHeader[:len(prefix)], prefix) {
		return nil
	}
	claims, err := users.VerifyToken(authHeader[len(prefix):], secret)
	if err != nil {
		return nil
	}
	return claims
}

// jsonResponse encodes v as JSON and writes it with the given status code.
func jsonResponse(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func toScoreDTO(sc *scores.Score) scoreDTO {
	return scoreDTO{
		ID:          sc.ID,
		UserID:      sc.UserID,
		Username:    sc.Username,
		WaveReached: sc.WaveReached,
		BaseHPLeft:  sc.BaseHPLeft,
		DurationMs:  sc.DurationMs,
		Coop:        sc.Coop,
		CreatedAt:   sc.CreatedAt,
	}
}
