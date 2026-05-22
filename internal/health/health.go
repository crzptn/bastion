package health

// Version is the API version reported by the health subsystem.
var Version = "dev"

// Result holds domain health state (no HTTP or serialization tags).
type Result struct {
	OK      bool
	Version string
}

// Status returns the current health result.
func Status() Result {
	return Result{OK: true, Version: Version}
}
