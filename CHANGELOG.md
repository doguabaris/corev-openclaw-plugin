# Changelog

## v0.1.0-alpha.2 / 2026-03-23
- Security hardening for host API and dashboard:
- Added route-level rate limiting across auth/project/config/log endpoints.
- Hardened auth/config input handling and query safety.
- Tightened CORS policy and removed query-string secret authentication.
- Reworked payload validation traversal guards and removed clear-text secret storage in dashboard localStorage.

## v0.1.0-alpha.1 / 2026-03-23
- Initial release
