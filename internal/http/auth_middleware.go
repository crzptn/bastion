package http

import (
	"context"
	"net/http"
	"strings"

	"github.com/joakimcarlsson/minmux/router"

	"github.com/JoakimCarlsson/bastion/internal/users"
)

type contextKey int

const authClaimsKey contextKey = iota

// AuthClaimsFromContext extracts the JWT claims stored by requireAuth.
// Returns nil when the context carries no claims (unauthenticated request).
func AuthClaimsFromContext(ctx context.Context) *users.Claims {
	v := ctx.Value(authClaimsKey)
	if v == nil {
		return nil
	}
	c, _ := v.(*users.Claims)
	return c
}

// requireAuth wraps a router.Context handler with Bearer JWT enforcement.
// On success the *users.Claims are stored in the request context via
// authClaimsKey. On failure a 401 JSON response is written and the handler
// is not called.
func requireAuth(
	secret []byte,
	handler func(c *router.Context),
) func(c *router.Context) {
	return func(c *router.Context) {
		authHeader := c.Request.Header.Get("Authorization")
		const prefix = "Bearer "
		if len(authHeader) < len(prefix) ||
			!strings.EqualFold(authHeader[:len(prefix)], prefix) {
			c.JSON(
				http.StatusUnauthorized,
				errorResponse{Error: "unauthorized"},
			)
			return
		}
		tokenStr := authHeader[len(prefix):]
		claims, err := users.VerifyToken(tokenStr, secret)
		if err != nil {
			c.JSON(
				http.StatusUnauthorized,
				errorResponse{Error: "unauthorized"},
			)
			return
		}
		ctx := context.WithValue(c.Request.Context(), authClaimsKey, claims)
		c.Request = c.Request.WithContext(ctx)
		handler(c)
	}
}
