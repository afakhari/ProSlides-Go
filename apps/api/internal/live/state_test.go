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

func TestActivityActionGuards(t *testing.T) {
	accepting := ActivityAccepting
	closed := ActivityClosed
	revealed := ActivityRevealed

	tests := []struct {
		name   string
		state  State
		phase  *ActivityPhase
		action string
		want   bool
	}{
		{name: "start draft", state: Draft, action: "start", want: true},
		{name: "start lobby rejected", state: Lobby, action: "start"},
		{name: "present first lobby item", state: Lobby, action: "present_item", want: true},
		{name: "advance from content", state: Presenting, action: "present_item", want: true},
		{name: "cannot skip accepting activity", state: Presenting, phase: &accepting, action: "present_item"},
		{name: "cannot skip closed activity result", state: Presenting, phase: &closed, action: "present_item"},
		{name: "advance after reveal", state: Presenting, phase: &revealed, action: "present_item", want: true},
		{name: "close accepting", state: Presenting, phase: &accepting, action: "close_activity", want: true},
		{name: "close twice rejected", state: Presenting, phase: &closed, action: "close_activity"},
		{name: "reveal closed", state: Presenting, phase: &closed, action: "reveal_activity", want: true},
		{name: "reveal before close rejected", state: Presenting, phase: &accepting, action: "reveal_activity"},
		{name: "ranking after reveal", state: Presenting, phase: &revealed, action: "show_overall_ranking", want: true},
		{name: "ranking before reveal rejected", state: Presenting, phase: &closed, action: "show_overall_ranking"},
		{name: "end lobby", state: Lobby, action: "end", want: true},
		{name: "end content", state: Presenting, action: "end", want: true},
		{name: "end accepting rejected", state: Presenting, phase: &accepting, action: "end"},
		{name: "end closed", state: Presenting, phase: &closed, action: "end", want: true},
		{name: "unknown action", state: Lobby, action: "invent_state"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := CanApplyAction(tc.state, tc.phase, tc.action); got != tc.want {
				t.Fatalf("CanApplyAction(%q, %v, %q) = %v, want %v", tc.state, tc.phase, tc.action, got, tc.want)
			}
		})
	}
}
