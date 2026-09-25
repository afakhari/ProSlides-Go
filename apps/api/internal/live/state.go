package live

import "errors"

type State string

const (
	Draft      State = "draft"
	Lobby      State = "lobby"
	Presenting State = "presenting"
	Ended      State = "ended"
)

type ActivityPhase string

const (
	ActivityAccepting ActivityPhase = "accepting"
	ActivityClosed    ActivityPhase = "closed"
	ActivityRevealed  ActivityPhase = "revealed"
)

type StageView string

const (
	StageItem           StageView = "item"
	StageOverallRanking StageView = "overall_ranking"
)

var ErrInvalidTransition = errors.New("invalid live state transition")

func CanTransition(from, to State) bool {
	switch from {
	case Draft:
		return to == Lobby
	case Lobby:
		return to == Presenting || to == Ended
	case Presenting:
		return to == Presenting || to == Ended
	}
	return false
}
