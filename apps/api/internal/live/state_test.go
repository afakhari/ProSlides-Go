package live

import "testing"

func TestStateTransitions(t *testing.T) {
	allowed := map[State]map[State]bool{
		Draft:      {Lobby: true},
		Lobby:      {Presenting: true, Ended: true},
		Presenting: {Presenting: true, Ended: true},
		Ended:      {},
	}
	states := []State{Draft, Lobby, Presenting, Ended}
	for _, from := range states {
		for _, to := range states {
			if got, want := CanTransition(from, to), allowed[from][to]; got != want {
				t.Fatalf("CanTransition(%q, %q) = %v, want %v", from, to, got, want)
			}
		}
	}
}
