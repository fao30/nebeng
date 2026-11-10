package main

import (
	"crypto/hmac"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

func newID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

func randomToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func hashPassword(password, salt string) string {
	key, _ := pbkdf2.Key(sha256.New, password, []byte(salt), 120_000, 32)
	return hex.EncodeToString(key)
}

func checkPassword(u *User, password string) bool {
	got := hashPassword(password, u.Salt)
	return subtle.ConstantTimeCompare([]byte(got), []byte(u.PassHash)) == 1
}

type tokenClaims struct {
	UID string `json:"uid"`
	Exp int64  `json:"exp"`
}

type Signer struct{ secret []byte }

func (s Signer) Issue(uid string, ttl time.Duration) string {
	payload, _ := json.Marshal(tokenClaims{UID: uid, Exp: time.Now().Add(ttl).Unix()})
	p := base64.RawURLEncoding.EncodeToString(payload)
	return p + "." + s.sign(p)
}

func (s Signer) sign(p string) string {
	m := hmac.New(sha256.New, s.secret)
	m.Write([]byte(p))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

func (s Signer) Verify(token string) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return "", errors.New("token tidak valid")
	}
	if !hmac.Equal([]byte(s.sign(parts[0])), []byte(parts[1])) {
		return "", errors.New("token tidak valid")
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", errors.New("token tidak valid")
	}
	var c tokenClaims
	if err := json.Unmarshal(raw, &c); err != nil {
		return "", errors.New("token tidak valid")
	}
	if time.Now().Unix() > c.Exp {
		return "", errors.New("sesi kedaluwarsa, silakan login ulang")
	}
	return c.UID, nil
}
