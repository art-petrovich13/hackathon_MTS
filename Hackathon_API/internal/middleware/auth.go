package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/art-petrovich13/hackathon_MTS/internal/auth"
	"github.com/art-petrovich13/hackathon_MTS/internal/ctxkeys"
)

// Authenticate — проверяет Bearer-токен в заголовке Authorization.
// Если токен валиден — кладёт Claims в context и пропускает запрос дальше.
// Если нет — возвращает 401.
func Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "Authorization header required")
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := auth.ValidateToken(tokenStr)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Invalid or expired token")
			return
		}
		ctx := context.WithValue(r.Context(), ctxkeys.ClaimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireAdmin — проверяет что роль пользователя "admin".
// Должен идти ПОСЛЕ Authenticate в цепочке middleware.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := ClaimsFromContext(r.Context())
		if claims == nil || claims.Role != "admin" {
			writeError(w, http.StatusForbidden, "Admin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ClaimsFromContext достаёт Claims из context.
// Используй в хендлерах: claims := middleware.ClaimsFromContext(r.Context())
func ClaimsFromContext(ctx context.Context) *auth.Claims {
	v := ctx.Value(ctxkeys.ClaimsKey)
	if v == nil {
		return nil
	}
	c, _ := v.(*auth.Claims)
	return c
}

// writeError — локальная вспомогательная функция (чтобы не зависеть от пакета handlers)
func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write([]byte(`{"error":"` + msg + `"}`))
}
