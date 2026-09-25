package live

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/proslides/proslides/internal/presentations"
	"golang.org/x/text/unicode/norm"
)

type choiceActivityResponse struct {
	SelectedOptionIndexes []int `json:"selected_option_indexes"`
}

type textActivityResponse struct {
	Text string `json:"text"`
}

type storedTextActivityResponse struct {
	Text  string   `json:"text"`
	Terms []string `json:"terms"`
}

func normalizeActivityResponse(
	definition presentations.ActivityDefinition,
	raw json.RawMessage,
) (json.RawMessage, []int, error) {
	if len(raw) == 0 || len(raw) > 8192 {
		return nil, nil, ErrInvalid
	}

	switch definition.ActivityKind {
	case presentations.ActivityKindChoice:
		var response choiceActivityResponse
		if err := decodeStrictResponse(raw, &response); err != nil {
			return nil, nil, ErrInvalid
		}
		if len(response.SelectedOptionIndexes) == 0 ||
			len(response.SelectedOptionIndexes) > len(definition.Response.Options) {
			return nil, nil, ErrInvalid
		}

		seen := make(map[int]struct{}, len(response.SelectedOptionIndexes))
		for _, index := range response.SelectedOptionIndexes {
			if index < 0 || index >= len(definition.Response.Options) {
				return nil, nil, ErrInvalid
			}
			if _, duplicate := seen[index]; duplicate {
				return nil, nil, ErrInvalid
			}
			seen[index] = struct{}{}
		}
		if definition.Response.Selection == presentations.ChoiceSelectionSingle &&
			len(response.SelectedOptionIndexes) != 1 {
			return nil, nil, ErrInvalid
		}

		normalized, err := json.Marshal(response)
		if err != nil {
			return nil, nil, err
		}
		return normalized, response.SelectedOptionIndexes, nil

	case presentations.ActivityKindText:
		var response textActivityResponse
		if err := decodeStrictResponse(raw, &response); err != nil {
			return nil, nil, ErrInvalid
		}
		text := strings.TrimSpace(norm.NFKC.String(response.Text))
		if text == "" || utf8.RuneCountInString(text) > definition.Response.MaxLength {
			return nil, nil, ErrInvalid
		}
		tokens := wordCloudTokens(text)
		if len(tokens) == 0 || len(tokens) > definition.Response.MaxWords {
			return nil, nil, ErrInvalid
		}
		normalized, err := json.Marshal(storedTextActivityResponse{
			Text:  text,
			Terms: uniqueWordCloudTerms(tokens),
		})
		if err != nil {
			return nil, nil, err
		}
		return normalized, nil, nil
	default:
		return nil, nil, ErrInvalid
	}
}

func wordCloudTokens(value string) []string {
	normalized := strings.ToLower(norm.NFKC.String(value))
	tokens := make([]string, 0, 4)
	var current []rune

	flush := func() {
		if len(current) == 0 {
			return
		}
		term := strings.Trim(string(current), "'’\u200c\u200d")
		current = current[:0]
		if term != "" {
			tokens = append(tokens, term)
		}
	}

	for _, rawRune := range normalized {
		r := canonicalWordCloudRune(rawRune)
		if unicode.IsLetter(r) ||
			unicode.IsNumber(r) ||
			unicode.IsMark(r) ||
			r == '\u200c' ||
			r == '\u200d' ||
			((r == '\'' || r == '’') && len(current) > 0) {
			current = append(current, r)
			continue
		}
		flush()
	}
	flush()
	return tokens
}

func canonicalWordCloudRune(r rune) rune {
	// Persian users frequently paste Arabic keyboard variants. These glyphs
	// are visually equivalent in Persian Word Clouds but NFKC intentionally
	// keeps them distinct, so canonicalize only the aggregation key.
	switch r {
	case 'ي':
		return 'ی'
	case 'ك':
		return 'ک'
	default:
		return r
	}
}

func uniqueWordCloudTerms(tokens []string) []string {
	terms := make([]string, 0, len(tokens))
	seen := make(map[string]struct{}, len(tokens))
	for _, term := range tokens {
		if _, duplicate := seen[term]; duplicate {
			continue
		}
		seen[term] = struct{}{}
		terms = append(terms, term)
	}
	return terms
}

func decodeStrictResponse(raw json.RawMessage, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return ErrInvalid
	}
	return nil
}
