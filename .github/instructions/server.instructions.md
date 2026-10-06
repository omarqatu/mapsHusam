---
applyTo: "server.js,server/**,lib/**,shared/**"
---
# Backend (Express + PostgreSQL)

- Functionality-preserving improvements only: existing endpoints keep their URLs, methods, auth rules and response shapes,
  because the React app depends on them.
- Each server improvement is its own commit and is logged in `docs/react-migration/PLAN.md` under "Server changes"
  (what, why, how to verify). Anything bigger or behaviour-changing goes to "Backend asks" for the owner to decide.
- Pure rules live in `lib/` with a unit test next to them (`lib/*.test.js`); routes in `server/routes/` stay thin.
- Validate every input at the route (types, enums, ids as digits), use parameterised SQL only, and rate-limit public writes.
- Notification titles and texts carry no emoji.
- Run the server unit tests before pushing; see `dev/README.md` for the local database.
