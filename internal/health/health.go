package health

// Status represents subsystem health.
type Status string

const (
	// StatusUp indicates the subsystem is healthy.
	StatusUp Status = "up"
)

// Check returns the current health status. HTTP exposure is added in issue #2.
func Check() Status {
	return StatusUp
}
