package live

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParticipantActiveItemRemovesCorrectnessMetadata(t *testing.T) {
	raw := json.RawMessage(`{"id":"item-1","kind":"activity","content":{"evaluation":{"correct_option_ids":["a"]},"response":{"options":[{"id":"a","text":"A"},{"id":"b","text":"B"}]}}}`)

	sanitized, err := sanitizeParticipantActiveItem(raw)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{"is_correct", "correct_answer", "correct_option_indexes", "correct_option_ids"} {
		if strings.Contains(string(sanitized), forbidden) {
			t.Fatalf("participant active item disclosed %q: %s", forbidden, sanitized)
		}
	}
	if !strings.Contains(string(sanitized), `"text":"A"`) {
		t.Fatalf("participant item content was not preserved: %s", sanitized)
	}
}

func TestParticipantActiveItemAcceptsEmptyPayload(t *testing.T) {
	sanitized, err := sanitizeParticipantActiveItem(nil)
	if err != nil || sanitized != nil {
		t.Fatalf("empty active slide = %q, %v", sanitized, err)
	}
}
