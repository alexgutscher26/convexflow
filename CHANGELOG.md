# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `"engines"` field to `frontend/package.json` to enforce specific Node.js and package manager versions.
- SEO tags, Meta Description, and Open Graph config to index file.
- Custom `favicon.ico` asset representation for frontend.
- Dedicated `SECURITY.md` defining vulnerable reporting processes.

---

## [0.1.0] - 2026-05-17

### Added
- **Security Headers Middleware**: Implemented custom HTTP middleware in FastAPI backend, enforcing `Content-Security-Policy` (CSP) directives, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `X-XSS-Protection` to harden server endpoints.
- **JWT Refresh Token Pattern**: Configured sliding session renewals via a secure, indexed database-backed refresh token endpoint.
- **Indentation Consistency**: Integrated project-wide `.editorconfig` setting standard spacing parameters (4 spaces for Python; 2 spaces for JS/TS/JSX/TSX/CSS/YAML).
- **Changelog Tracker**: Added initial `CHANGELOG.md` implementing the official *Keep a Changelog* format.

### Changed
- **Dependency Version Pinning**: Aligned and pinned all packages in `backend/requirements.txt` to exact tested active-environment release versions for fully reproducible builds.
- **Top-Level base64 Imports**: Reorganized `backend/server.py` standard library declarations, moving `import base64` out of loops to prevent duplicate imports during repository scanning.

### Removed
- **Environment Cleanup**: Purged unused large dependencies (`pandas` and `numpy`) from `requirements.txt` and the backend runtime.

### Security
- **GitHub PAT Encryption at Rest**: remeditated plaintext repository sync access token storage by implementing strong symmetric AES/Fernet encryption for all saved GitHub credentials.
