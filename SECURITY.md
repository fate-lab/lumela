# Security Policy

## Supported versions

Only the latest release receives security fixes. Lumela updates itself, so please keep it up to date.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report it privately with GitHub's [private vulnerability reporting](https://github.com/tw4/lumela/security/advisories/new).
Include the version, your operating system, steps to reproduce and the impact you expect.

You can expect an acknowledgement within a few days. We will keep you updated while we
work on a fix and credit you in the release notes unless you prefer otherwise.

## Scope

Lumela runs locally and has no server component. Relevant areas include the update
mechanism (signed updates), file handling (opening images, saving exports, history) and
the bundled web UI (content security policy).
