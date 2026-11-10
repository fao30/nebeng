package main

import (
	"log"
	"time"
)

// Team accounts that must exist on every start (the free hosting disk is
// wiped on each restart). Only PBKDF2 hashes are stored here — the repo is
// public, so passwords are never committed. They are all admins and can
// still use the app as passenger or driver.
var teamAccounts = []struct{ Name, Email, Salt, Hash string }{
	{Name: "Fakhrul Arifin", Email: "fakhrul@nebeng.id", Salt: "reYxOEPxVZ8TUtUR0R82Rw", Hash: "d43e7ac6250884427cb2cd3f3505eadd8796bab062db3eb2b855321cfc4563ba"},
	{Name: "Nanda", Email: "nanda@nebeng.id", Salt: "0YU4_FtlbvrXjtJcOH7uwA", Hash: "c4c837e0302c633645aae135b46aff3ffbeeadfc7dc584fbaf308509dba015b2"},
	{Name: "Admin Numpang", Email: "admin@nebeng.id", Salt: "zWz76WWxal60mDJUwyEY5g", Hash: "dccf1cfef11e927851ce114b0171d3bd5b7009bfad0ecb921f93ed9023e7792d"},
}

func ensureTeamAccounts(s *Store) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, a := range teamAccounts {
		if id, ok := s.byEmail[a.Email]; ok {
			s.Users[id].IsAdmin = true
			continue
		}
		u := &User{ID: newID("usr"), Name: a.Name, Email: a.Email, Salt: a.Salt, PassHash: a.Hash, IsAdmin: true, CreatedAt: time.Now(),
			IdentityStatus: KYCApproved}
		s.Users[u.ID] = u
		s.byEmail[u.Email] = u.ID
		log.Printf("team account ready: %s", a.Email)
	}
	s.Changed()
}
