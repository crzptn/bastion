package http_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/joakimcarlsson/minmux/router"

	bhttp "github.com/JoakimCarlsson/bastion/internal/http"
	"github.com/JoakimCarlsson/bastion/internal/users"
)

// --- fake usersService ---

type fakeUsersSvc struct {
	users map[string]*users.User
}

func newFakeUsersSvc() *fakeUsersSvc {
	return &fakeUsersSvc{users: make(map[string]*users.User)}
}

func (f *fakeUsersSvc) Register(
	_ context.Context,
	username, password string,
) (*users.User, error) {
	if username == "" || password == "" {
		return nil, users.ErrInvalidInput
	}
	key := strings.ToLower(username)
	if _, exists := f.users[key]; exists {
		return nil, users.ErrDuplicateUsername
	}
	u := &users.User{
		ID:        "uid-" + key,
		Username:  username,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	f.users[key] = u
	return u, nil
}

func (f *fakeUsersSvc) Authenticate(
	_ context.Context,
	username, password string,
) (*users.User, error) {
	key := strings.ToLower(username)
	u, ok := f.users[key]
	if !ok {
		return nil, users.ErrInvalidCredentials
	}
	// fake: password "good" always works; anything else fails
	if password != "good" {
		return nil, users.ErrInvalidCredentials
	}
	return u, nil
}

func (f *fakeUsersSvc) GetByID(
	_ context.Context,
	id string,
) (*users.User, error) {
	for _, u := range f.users {
		if u.ID == id {
			cp := *u
			return &cp, nil
		}
	}
	return nil, users.ErrNotFound
}

// helpers

var testJWTSecret = []byte("test-secret-32-chars-padding-here!")
var testJWTTTL = time.Hour

// newTestHandler builds a minimal router with only the users routes.
func newTestHandler(svc *fakeUsersSvc) http.Handler {
	r := router.New()
	// use exported constructor — we call the package-internal registerUsers via
	// the public handler wiring path.
	// Build a handler.Config with nil pool (no DB needed for unit tests).
	handler := bhttp.NewHandlerWithUsers(r, svc, testJWTSecret, testJWTTTL)
	return handler
}

// ----- AC1 tests -----

func TestRegister_Success(t *testing.T) {
	h := newTestHandler(newFakeUsersSvc())
	body := `{"username":"alice","password":"hunter2"}`
	rec := doRequest(h, http.MethodPost, "/api/auth/register", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status: got %d want 201; body: %s", rec.Code, rec.Body)
	}
	var resp struct {
		UserID   string `json:"user_id"`
		Username string `json:"username"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.UserID == "" {
		t.Error("expected non-empty user_id")
	}
	if resp.Username != "alice" {
		t.Errorf("username: got %q want %q", resp.Username, "alice")
	}
}

func TestRegister_DuplicateReturns409(t *testing.T) {
	h := newTestHandler(newFakeUsersSvc())
	body := `{"username":"alice","password":"hunter2"}`
	doRequest(h, http.MethodPost, "/api/auth/register", body)
	rec := doRequest(h, http.MethodPost, "/api/auth/register", body)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status: got %d want 409; body: %s", rec.Code, rec.Body)
	}
}

func TestRegister_MissingFieldsReturns400(t *testing.T) {
	h := newTestHandler(newFakeUsersSvc())
	rec := doRequest(
		h,
		http.MethodPost,
		"/api/auth/register",
		`{"username":"alice"}`,
	)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400; body: %s", rec.Code, rec.Body)
	}
}

// ----- AC2 tests -----

func TestLogin_ReturnsTokenAndBadPasswordIs401(t *testing.T) {
	svc := newFakeUsersSvc()
	// pre-seed a user
	_, _ = svc.Register(context.Background(), "bob", "good")

	h := newTestHandler(svc)

	// good password
	rec := doRequest(
		h,
		http.MethodPost,
		"/api/auth/login",
		`{"username":"bob","password":"good"}`,
	)
	if rec.Code != http.StatusOK {
		t.Fatalf("login good: status %d, body: %s", rec.Code, rec.Body)
	}
	var resp struct {
		Token string `json:"token"`
		User  struct {
			ID       string `json:"id"`
			Username string `json:"username"`
		} `json:"user"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Token == "" {
		t.Error("expected non-empty token")
	}
	if resp.User.Username != "bob" {
		t.Errorf("user.username: got %q want %q", resp.User.Username, "bob")
	}

	// bad password
	rec = doRequest(
		h,
		http.MethodPost,
		"/api/auth/login",
		`{"username":"bob","password":"wrong"}`,
	)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("login bad: status %d want 401, body: %s", rec.Code, rec.Body)
	}
}

// ----- AC3 tests -----

func TestProtectedRoute_TokenGate(t *testing.T) {
	svc := newFakeUsersSvc()
	_, _ = svc.Register(context.Background(), "carol", "good")
	h := newTestHandler(svc)

	// 1. No token → 401
	rec := doRequest(h, http.MethodGet, "/api/auth/me", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("no token: status %d want 401, body: %s", rec.Code, rec.Body)
	}

	// 2. Valid token → 200
	loginRec := doRequest(
		h,
		http.MethodPost,
		"/api/auth/login",
		`{"username":"carol","password":"good"}`,
	)
	if loginRec.Code != http.StatusOK {
		t.Fatalf("login: status %d, body: %s", loginRec.Code, loginRec.Body)
	}
	var loginResp struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(loginRec.Body.Bytes(), &loginResp); err != nil {
		t.Fatalf("decode login: %v", err)
	}

	rec = doRequestWithAuth(
		h,
		http.MethodGet,
		"/api/auth/me",
		"",
		loginResp.Token,
	)
	if rec.Code != http.StatusOK {
		t.Fatalf(
			"valid token: status %d want 200, body: %s",
			rec.Code,
			rec.Body,
		)
	}

	// 3. Tampered token → 401
	tampered := loginResp.Token[:len(loginResp.Token)-1] + "X"
	rec = doRequestWithAuth(h, http.MethodGet, "/api/auth/me", "", tampered)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf(
			"tampered token: status %d want 401, body: %s",
			rec.Code,
			rec.Body,
		)
	}
}

// --- helpers ---

func doRequest(
	h http.Handler,
	method, path, body string,
) *httptest.ResponseRecorder {
	var reqBody *bytes.Reader
	if body != "" {
		reqBody = bytes.NewReader([]byte(body))
	} else {
		reqBody = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func doRequestWithAuth(
	h http.Handler,
	method, path, body, token string,
) *httptest.ResponseRecorder {
	var reqBody *bytes.Reader
	if body != "" {
		reqBody = bytes.NewReader([]byte(body))
	} else {
		reqBody = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}
