package migrate

import (
	"strings"
	"testing"
)

func TestEmbeddedMigrationsRejectBareDollarQuoteDelimiters(t *testing.T) {
	entries, err := files.ReadDir("sql")
	if err != nil {
		t.Fatalf("read embedded migrations: %v", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		body, err := files.ReadFile("sql/" + entry.Name())
		if err != nil {
			t.Fatalf("read migration %s: %v", entry.Name(), err)
		}

		for lineNumber, line := range strings.Split(string(body), "\n") {
			switch strings.TrimSpace(line) {
			case "DO $", "END $;":
				t.Fatalf(
					"migration %s contains an invalid bare dollar-quote delimiter on line %d: %q",
					entry.Name(),
					lineNumber+1,
					strings.TrimSpace(line),
				)
			}
		}
	}
}
