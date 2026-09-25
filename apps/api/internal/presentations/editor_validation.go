package presentations

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
)

var errInvalidSlideDefinition = errors.New("invalid slide definition")

func validateSlideContent(kind string, raw json.RawMessage) error {
	_, _, err := normalizeSlideDefinition(kind, raw)
	return err
}

func decodeStrictObject(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return errInvalidSlideDefinition
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errInvalidSlideDefinition
	}
	return nil
}
