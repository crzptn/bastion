package health

import "testing"

func TestStatus_OKAndVersion(t *testing.T) {
	prev := Version
	t.Cleanup(func() { Version = prev })

	Version = "1.2.3"
	got := Status()

	if !got.OK {
		t.Errorf("OK: got false, want true")
	}
	if got.Version != "1.2.3" {
		t.Errorf("Version: got %q, want %q", got.Version, "1.2.3")
	}
}

func TestStatus_DefaultVersion(t *testing.T) {
	prev := Version
	t.Cleanup(func() { Version = prev })

	Version = "dev"
	got := Status()

	if !got.OK {
		t.Errorf("OK: got false, want true")
	}
	if got.Version != "dev" {
		t.Errorf("Version: got %q, want %q", got.Version, "dev")
	}
}
