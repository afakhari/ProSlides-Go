package identity

import (
	"errors"
	"net/mail"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidRegistration = errors.New("invalid registration")

type Registration struct{ Email, DisplayName, Password string }
type Account struct {
	Email, DisplayName, PasswordHash string
	IsActive                         bool
}

// PrepareRegistration validates and normalizes data before it reaches a repository.
// Passwords never leave this function in plaintext.
func PrepareRegistration(input Registration) (Account, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	name := strings.TrimSpace(input.DisplayName)
	if len(email) > 320 || utf8.RuneCountInString(name) == 0 || utf8.RuneCountInString(name) > 100 || !validPassword(input.Password) {
		return Account{}, ErrInvalidRegistration
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return Account{}, ErrInvalidRegistration
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return Account{}, err
	}
	return Account{Email: email, DisplayName: name, PasswordHash: string(hash), IsActive: true}, nil
}

func VerifyPassword(password, hash string) bool {
	if hash == "" || hash == "!" {
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func HashPassword(password string) (string, error) {
	if !validPassword(password) {
		return "", ErrInvalidRegistration
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func validPassword(password string) bool {
	runeCount := utf8.RuneCountInString(password)
	if runeCount < 12 || runeCount > 128 || len([]byte(password)) > 72 {
		return false
	}
	onlyDigits := true
	for _, r := range password {
		if !unicode.IsDigit(r) {
			onlyDigits = false
			break
		}
	}
	return !onlyDigits
}
