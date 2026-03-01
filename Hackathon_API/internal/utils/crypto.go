package utils

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

// GeneratePassword создаёт безопасный случайный пароль длиной n символов.
func GeneratePassword(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	encoded := base64.URLEncoding.EncodeToString(b)
	if len(encoded) >= n {
		return encoded[:n]
	}
	return encoded
}

// GenerateUsername создаёт уникальное имя пользователя с префиксом.
func GenerateUsername(prefix string) string {
	b := make([]byte, 4)
	rand.Read(b) //nolint:errcheck
	return fmt.Sprintf("%s_%x", prefix, b)
}

// GenerateAccessKey создаёт access key в стиле AWS (20 символов, только заглавные и цифры).
func GenerateAccessKey() string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	randBytes := make([]byte, 20)
	rand.Read(randBytes) //nolint:errcheck
	b := make([]byte, 20)
	for i, rb := range randBytes {
		b[i] = chars[int(rb)%len(chars)]
	}
	return string(b)
}

// GenerateSecretKey создаёт secret key (40 URL-safe символов).
func GenerateSecretKey() string {
	b := make([]byte, 30)
	rand.Read(b) //nolint:errcheck
	encoded := base64.URLEncoding.EncodeToString(b)
	if len(encoded) >= 40 {
		return encoded[:40]
	}
	return encoded
}