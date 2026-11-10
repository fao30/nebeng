package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"
	_ "time/tzdata" // so Asia/Jakarta works in minimal containers
)

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	secret := env("JWT_SECRET", "")
	if secret == "" {
		secret = "dev-secret-change-me"
		log.Println("WARNING: JWT_SECRET not set, using an insecure development secret")
	}
	loc, err := time.LoadLocation(env("APP_TIMEZONE", "Asia/Jakarta"))
	if err != nil {
		log.Fatalf("timezone: %v", err)
	}

	store := NewStore(env("DATA_FILE", "data/nebeng.json"))
	api := &API{store: store, hub: NewLiveHub(), signer: Signer{secret: []byte(secret)}, loc: loc}
	if env("SEED_DEMO", "true") == "true" {
		Seed(store)
	}
	ensureTeamAccounts(store)
	promoteAdmins(store)

	go api.reminders(nil)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"ok": true, "time": time.Now(), "version": version()})
	})

	mux.HandleFunc("POST /api/auth/register", api.h(api.register))
	mux.HandleFunc("POST /api/auth/login", api.h(api.login))
	mux.HandleFunc("GET /api/me", api.auth(api.me))
	mux.HandleFunc("PUT /api/me", api.auth(api.updateMe))

	// trips (driver creates, passenger searches)
	mux.HandleFunc("GET /api/trips", api.h(api.searchTrips))
	mux.HandleFunc("POST /api/trips", api.auth(api.createTrip))
	mux.HandleFunc("GET /api/trips/{id}", api.h(api.getTrip))
	mux.HandleFunc("POST /api/trips/{id}/status", api.auth(api.tripStatus))
	mux.HandleFunc("POST /api/trips/{id}/bookings", api.auth(api.createBooking))
	mux.HandleFunc("GET /api/trips/{id}/share", api.auth(api.shareLink))
	mux.HandleFunc("POST /api/trips/{id}/location", api.auth(api.postLocation))

	// negotiation & chat
	mux.HandleFunc("POST /api/bookings/{id}/respond", api.auth(api.respondBooking))
	mux.HandleFunc("GET /api/bookings/{id}/messages", api.auth(api.listMessages))
	mux.HandleFunc("POST /api/bookings/{id}/messages", api.auth(api.postMessage))
	mux.HandleFunc("GET /api/bookings/{id}/stream", api.auth(api.bookingStream))

	// platform settings (public read) & admin CRM
	mux.HandleFunc("GET /api/notifications", api.auth(api.listNotifications))
	mux.HandleFunc("POST /api/notifications/read", api.auth(api.readNotifications))
	mux.HandleFunc("GET /api/notifications/stream", api.auth(api.notificationStream))
	mux.HandleFunc("PUT /api/me/routes", api.auth(api.saveRoutes))
	mux.HandleFunc("GET /api/admin/notifications", api.adminOnly(api.adminNotifications))
	mux.HandleFunc("POST /api/bookings/{id}/boarding-code", api.auth(api.boardingCode))
	mux.HandleFunc("POST /api/bookings/{id}/board", api.auth(api.board))
	mux.HandleFunc("POST /api/bookings/{id}/dropoff", api.auth(api.dropoff))
	mux.HandleFunc("POST /api/bookings/{id}/rating", api.auth(api.rate))
	mux.HandleFunc("POST /api/bookings/{id}/report", api.auth(api.createReport))
	mux.HandleFunc("GET /api/my/ratings", api.auth(api.myRatings))
	mux.HandleFunc("GET /api/my/reports", api.auth(api.myReports))
	mux.HandleFunc("GET /api/admin/reports", api.adminOnly(api.adminReports))
	mux.HandleFunc("POST /api/admin/reports/{id}", api.adminOnly(api.adminUpdateReport))
	mux.HandleFunc("POST /api/admin/users/{id}/block", api.adminOnly(api.adminBlock))
	mux.HandleFunc("POST /api/me/terms", api.auth(api.acceptTerms))
	mux.HandleFunc("GET /api/settings", api.h(api.getSettings))
	mux.HandleFunc("PUT /api/admin/settings", api.adminOnly(api.putSettings))
	mux.HandleFunc("GET /api/admin/stats", api.adminOnly(api.adminStats))
	mux.HandleFunc("GET /api/admin/trips", api.adminOnly(api.adminTrips))
	mux.HandleFunc("GET /api/admin/users", api.adminOnly(api.adminUsers))
	mux.HandleFunc("GET /api/admin/conversations", api.adminOnly(api.adminConversations))

	// ride requests (passenger posts, driver browses & offers)
	mux.HandleFunc("GET /api/requests", api.auth(api.listRequests))
	mux.HandleFunc("POST /api/requests", api.auth(api.createRequest))
	mux.HandleFunc("POST /api/requests/{id}/offer", api.auth(api.offerOnRequest))
	mux.HandleFunc("POST /api/requests/{id}/cancel", api.auth(api.cancelRequest))

	// dashboards
	mux.HandleFunc("GET /api/my/trips", api.auth(api.myTrips))
	mux.HandleFunc("GET /api/my/bookings", api.auth(api.myBookings))
	mux.HandleFunc("GET /api/my/requests", api.auth(api.myRequests))

	// public live sharing (anyone with the link)
	mux.HandleFunc("GET /api/live/{token}", api.h(api.liveSnapshot))
	mux.HandleFunc("GET /api/live/{token}/stream", api.h(api.liveStream))

	addr := ":" + env("PORT", "8080")
	log.Printf("nebeng API listening on %s", addr)
	srv := &http.Server{Addr: addr, Handler: logging(cors(mux)), ReadHeaderTimeout: 10 * time.Second}
	log.Fatal(srv.ListenAndServe())
}

// version reports the deployed commit (Render sets RENDER_GIT_COMMIT).
func version() string {
	v := os.Getenv("RENDER_GIT_COMMIT")
	if len(v) > 7 {
		v = v[:7]
	}
	if v == "" {
		v = "dev"
	}
	return v
}

func cors(next http.Handler) http.Handler {
	allowed := strings.Split(env("ALLOWED_ORIGINS", "*"), ",")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		for _, a := range allowed {
			a = strings.TrimSpace(a)
			if a == "*" || a == origin {
				if a == "*" {
					w.Header().Set("Access-Control-Allow-Origin", "*")
				} else {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Add("Vary", "Origin")
				}
				break
			}
		}
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		if !strings.HasSuffix(r.URL.Path, "/location") {
			log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
		}
	})
}
