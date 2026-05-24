package http

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/lobby"
)

// lobbyService is the interface this package requires from the lobby domain.
type lobbyService interface {
	Create(ctx context.Context, in lobby.CreateInput) (*lobby.Lobby, error)
	Get(ctx context.Context, id string) (*lobby.Lobby, error)
	ListOpen(ctx context.Context) ([]*lobby.Lobby, error)
	Join(
		ctx context.Context,
		lobbyID string,
		in lobby.JoinInput,
	) (*lobby.Lobby, error)
	Leave(ctx context.Context, lobbyID, playerID string) (*lobby.Lobby, error)
	Start(
		ctx context.Context,
		lobbyID, callerPlayerID string,
	) (*lobby.Lobby, error)
}

// ---- DTOs ----

type lobbyPlayerDTO struct {
	PlayerID    string    `json:"player_id"`
	DisplayName string    `json:"display_name"`
	Slot        int       `json:"slot"`
	JoinedAt    time.Time `json:"joined_at"`
}

type lobbyResponse struct {
	ID           string           `json:"id"`
	Name         string           `json:"name"`
	HostPlayerID string           `json:"host_player_id"`
	MaxPlayers   int              `json:"max_players"`
	Status       string           `json:"status"`
	SessionID    string           `json:"session_id,omitempty"`
	Players      []lobbyPlayerDTO `json:"players"`
	CreatedAt    time.Time        `json:"created_at"`
	UpdatedAt    time.Time        `json:"updated_at"`
}

type errorResponse struct {
	Error string `json:"error"`
}

// ---- Params structs for path/query/body binding ----

type createLobbyParams struct {
	Body struct {
		Name         string `json:"name"`
		HostPlayerID string `json:"host_player_id"`
		DisplayName  string `json:"display_name"`
		MaxPlayers   int    `json:"max_players"`
	} `body:""`
}

type lobbyIDParams struct {
	ID string `path:"id"`
}

type joinLobbyParams struct {
	ID   string `path:"id"`
	Body struct {
		PlayerID    string `json:"player_id"`
		DisplayName string `json:"display_name"`
	} `body:""`
}

type leaveStartParams struct {
	ID   string `path:"id"`
	Body struct {
		PlayerID string `json:"player_id"`
	} `body:""`
}

// registerLobby mounts the six lobby routes on r.
func registerLobby(r *router.Router, svc lobbyService) {
	r.Post("/api/lobbies", func(c *router.Context, p createLobbyParams) {
		if p.Body.Name == "" || p.Body.HostPlayerID == "" {
			c.JSON(
				http.StatusBadRequest,
				errorResponse{Error: "name and host_player_id required"},
			)
			return
		}
		l, err := svc.Create(c.Ctx(), lobby.CreateInput{
			Name:         p.Body.Name,
			HostPlayerID: p.Body.HostPlayerID,
			DisplayName:  p.Body.DisplayName,
			MaxPlayers:   p.Body.MaxPlayers,
		})
		if err != nil {
			writeLobbyError(c, err)
			return
		}
		c.JSON(http.StatusCreated, toLobbyResponse(l))
	})

	r.Get("/api/lobbies", func(c *router.Context) {
		lobbies, err := svc.ListOpen(c.Ctx())
		if err != nil {
			writeLobbyError(c, err)
			return
		}
		dtos := make([]lobbyResponse, 0, len(lobbies))
		for _, l := range lobbies {
			dtos = append(dtos, toLobbyResponse(l))
		}
		c.JSON(http.StatusOK, dtos)
	})

	r.Get("/api/lobbies/{id}", func(c *router.Context, p lobbyIDParams) {
		l, err := svc.Get(c.Ctx(), p.ID)
		if err != nil {
			writeLobbyError(c, err)
			return
		}
		c.JSON(http.StatusOK, toLobbyResponse(l))
	})

	r.Post(
		"/api/lobbies/{id}/join",
		func(c *router.Context, p joinLobbyParams) {
			if p.Body.PlayerID == "" {
				c.JSON(
					http.StatusBadRequest,
					errorResponse{Error: "player_id required"},
				)
				return
			}
			l, err := svc.Join(c.Ctx(), p.ID, lobby.JoinInput{
				PlayerID:    p.Body.PlayerID,
				DisplayName: p.Body.DisplayName,
			})
			if err != nil {
				writeLobbyError(c, err)
				return
			}
			c.JSON(http.StatusOK, toLobbyResponse(l))
		},
	)

	r.Post(
		"/api/lobbies/{id}/leave",
		func(c *router.Context, p leaveStartParams) {
			if p.Body.PlayerID == "" {
				c.JSON(
					http.StatusBadRequest,
					errorResponse{Error: "player_id required"},
				)
				return
			}
			l, err := svc.Leave(c.Ctx(), p.ID, p.Body.PlayerID)
			if err != nil {
				writeLobbyError(c, err)
				return
			}
			c.JSON(http.StatusOK, toLobbyResponse(l))
		},
	)

	r.Post(
		"/api/lobbies/{id}/start",
		func(c *router.Context, p leaveStartParams) {
			if p.Body.PlayerID == "" {
				c.JSON(
					http.StatusBadRequest,
					errorResponse{Error: "player_id required"},
				)
				return
			}
			l, err := svc.Start(c.Ctx(), p.ID, p.Body.PlayerID)
			if err != nil {
				writeLobbyError(c, err)
				return
			}
			c.JSON(http.StatusOK, toLobbyResponse(l))
		},
	)
}

func writeLobbyError(c *router.Context, err error) {
	switch {
	case errors.Is(err, lobby.ErrInvalidInput):
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid_input"})
	case errors.Is(err, lobby.ErrNotFound):
		c.JSON(http.StatusNotFound, errorResponse{Error: "lobby_not_found"})
	case errors.Is(err, lobby.ErrFull):
		c.JSON(http.StatusConflict, errorResponse{Error: "lobby_full"})
	case errors.Is(err, lobby.ErrAlreadyJoined):
		c.JSON(http.StatusConflict, errorResponse{Error: "already_joined"})
	case errors.Is(err, lobby.ErrNotOpen):
		c.JSON(http.StatusConflict, errorResponse{Error: "lobby_not_open"})
	case errors.Is(err, lobby.ErrPlayerNotInLobby):
		c.JSON(http.StatusNotFound, errorResponse{Error: "player_not_in_lobby"})
	case errors.Is(err, lobby.ErrNotHost):
		c.JSON(http.StatusForbidden, errorResponse{Error: "not_host"})
	case errors.Is(err, lobby.ErrTooFewPlayers):
		c.JSON(http.StatusConflict, errorResponse{Error: "too_few_players"})
	case errors.Is(err, lobby.ErrAlreadyStarted):
		c.JSON(http.StatusConflict, errorResponse{Error: "already_started"})
	default:
		c.JSON(
			http.StatusInternalServerError,
			errorResponse{Error: "internal_error"},
		)
	}
}

func toLobbyResponse(l *lobby.Lobby) lobbyResponse {
	players := make([]lobbyPlayerDTO, len(l.Players))
	for i, p := range l.Players {
		players[i] = lobbyPlayerDTO{
			PlayerID:    p.PlayerID,
			DisplayName: p.DisplayName,
			Slot:        p.Slot,
			JoinedAt:    p.JoinedAt,
		}
	}
	return lobbyResponse{
		ID:           l.ID,
		Name:         l.Name,
		HostPlayerID: l.HostPlayerID,
		MaxPlayers:   l.MaxPlayers,
		Status:       string(l.Status),
		SessionID:    l.SessionID,
		Players:      players,
		CreatedAt:    l.CreatedAt,
		UpdatedAt:    l.UpdatedAt,
	}
}
