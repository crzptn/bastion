package http

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/users"
)

// usersService is the interface this package requires from the users domain.
type usersService interface {
	Register(
		ctx context.Context,
		username, password string,
	) (*users.User, error)
	Authenticate(
		ctx context.Context,
		username, password string,
	) (*users.User, error)
	GetByID(ctx context.Context, id string) (*users.User, error)
}

// ---- DTOs ----

type registerParams struct {
	Body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	} `body:""`
}

type loginParams struct {
	Body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	} `body:""`
}

type userDTO struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
}

type registerResponse struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
}

type loginResponse struct {
	Token string  `json:"token"`
	User  userDTO `json:"user"`
}

// registerUsers mounts the three auth routes on r.
func registerUsers(
	r *router.Router,
	svc usersService,
	jwtSecret []byte,
	jwtTTL time.Duration,
) {
	// POST /api/auth/register
	r.Post("/api/auth/register", func(c *router.Context, p registerParams) {
		if p.Body.Username == "" || p.Body.Password == "" {
			c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid_input"})
			return
		}
		u, err := svc.Register(c.Ctx(), p.Body.Username, p.Body.Password)
		if err != nil {
			writeUserError(c, err)
			return
		}
		c.JSON(http.StatusCreated, registerResponse{
			UserID:   u.ID,
			Username: u.Username,
		})
	})

	// POST /api/auth/login
	r.Post("/api/auth/login", func(c *router.Context, p loginParams) {
		if p.Body.Username == "" || p.Body.Password == "" {
			c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid_input"})
			return
		}
		u, err := svc.Authenticate(c.Ctx(), p.Body.Username, p.Body.Password)
		if err != nil {
			writeUserError(c, err)
			return
		}
		token, err := users.IssueToken(u.ID, u.Username, jwtSecret, jwtTTL)
		if err != nil {
			c.JSON(
				http.StatusInternalServerError,
				errorResponse{Error: "internal_error"},
			)
			return
		}
		c.JSON(http.StatusOK, loginResponse{
			Token: token,
			User: userDTO{
				ID:        u.ID,
				Username:  u.Username,
				CreatedAt: u.CreatedAt,
			},
		})
	})

	// GET /api/auth/me (protected)
	r.Get("/api/auth/me", requireAuth(jwtSecret, func(c *router.Context) {
		claims := AuthClaimsFromContext(c.Request.Context())
		if claims == nil {
			c.JSON(
				http.StatusUnauthorized,
				errorResponse{Error: "unauthorized"},
			)
			return
		}
		u, err := svc.GetByID(c.Ctx(), claims.UserID)
		if err != nil {
			writeUserError(c, err)
			return
		}
		c.JSON(http.StatusOK, userDTO{
			ID:        u.ID,
			Username:  u.Username,
			CreatedAt: u.CreatedAt,
		})
	}))
}

func writeUserError(c *router.Context, err error) {
	switch {
	case errors.Is(err, users.ErrInvalidInput):
		c.JSON(http.StatusBadRequest, errorResponse{Error: "invalid_input"})
	case errors.Is(err, users.ErrDuplicateUsername):
		c.JSON(http.StatusConflict, errorResponse{Error: "duplicate_username"})
	case errors.Is(err, users.ErrInvalidCredentials):
		c.JSON(
			http.StatusUnauthorized,
			errorResponse{Error: "invalid_credentials"},
		)
	case errors.Is(err, users.ErrNotFound):
		c.JSON(http.StatusNotFound, errorResponse{Error: "not_found"})
	default:
		c.JSON(
			http.StatusInternalServerError,
			errorResponse{Error: "internal_error"},
		)
	}
}
