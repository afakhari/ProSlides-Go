package identity

import (
	"errors"
	"strings"
	"testing"
)

func TestPrepareRegistrationNormalizesAndHashesPassword(t *testing.T) {
	account, err := PrepareRegistration(Registration{Email: " User@Example.COM ", DisplayName: "  User  ", Password: "long-enough-password"})
	if err != nil {
		t.Fatalf("PrepareRegistration() error = %v", err)
	}
	if account.Email != "user@example.com" || account.DisplayName != "User" {
		t.Fatalf("unexpected account: %#v", account)
	}
	if account.PasswordHash == "long-enough-password" || !VerifyPassword("long-enough-password", account.PasswordHash) {
		t.Fatal("password was not securely hashed")
	}
}

func TestPrepareRegistrationRejectsUnsafeInput(t *testing.T) {
	for _, input := range []Registration{{Email: "invalid", DisplayName: "User", Password: "long-enough-password"}, {Email: "u@example.com", DisplayName: "", Password: "long-enough-password"}, {Email: "u@example.com", DisplayName: "User", Password: "short"}} {
		if _, err := PrepareRegistration(input); !errors.Is(err, ErrInvalidRegistration) {
			t.Fatalf("error = %v, want ErrInvalidRegistration", err)
		}
	}
}

func TestIdentityPasswordPolicyHonorsUnicodeAndBcryptByteLimit(t *testing.T) {
	validAtLimit := strings.Repeat("é", 36) // 36 runes, 72 UTF-8 bytes.
	if _, err := HashPassword(validAtLimit); err != nil {
		t.Fatalf("HashPassword(validAtLimit) error = %v", err)
	}

	tooManyBytes := strings.Repeat("é", 37)
	if _, err := HashPassword(tooManyBytes); !errors.Is(err, ErrInvalidRegistration) {
		t.Fatalf("HashPassword(tooManyBytes) error = %v, want ErrInvalidRegistration", err)
	}

	if _, err := HashPassword("۱۲۳۴۵۶۷۸۹۰۱۲"); !errors.Is(err, ErrInvalidRegistration) {
		t.Fatalf("HashPassword(unicode digits) error = %v, want ErrInvalidRegistration", err)
	}

	unicodeName := strings.Repeat("کاربر", 20)
	if _, err := PrepareRegistration(Registration{Email: "unicode@example.com", DisplayName: unicodeName, Password: "valid-password-123"}); err != nil {
		t.Fatalf("PrepareRegistration(unicode name) error = %v", err)
	}
}
