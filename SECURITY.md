# Security Policy

We take the security of **ConvexFlow** seriously. If you believe you have found a security vulnerability in this project, please report it to us responsibly using the guidelines below.

## Supported Versions

Only the latest active release version of ConvexFlow is actively supported with security updates and patches:

| Version | Supported          |
| ------- | ------------------ |
| >= 1.0  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

**Do not open public GitHub issues for security vulnerabilities.**

Instead, please report security issues privately by emailing the maintainers at **security@convexflow.com**.

When reporting, please include:
- A detailed description of the vulnerability and its potential impact.
- Clear, step-by-step instructions (with proof-of-concept scripts or steps) to reproduce the issue.
- Details about your environment, operating system, and browser version.

We will acknowledge receipt of your report within **48 hours** and provide a tracking ID and estimated timeline for a patch.

## Scope

This security policy applies to:
- The backend API servers (`backend/`)
- The frontend visualization web application (`frontend/`)
- Underlying dependency versions pinned in `requirements.txt` and `package.json`

## Responsible Disclosure & Disclosure Timeline

We support coordinated vulnerability disclosure. Please give us at least **90 days** from the initial report to investigate, produce a fix, and coordinate a public release before disclosing details of the vulnerability publicly.

Thank you for helping us keep ConvexFlow secure!
