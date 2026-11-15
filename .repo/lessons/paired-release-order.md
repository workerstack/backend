---
name: paired-release-order
paths: ["packages/core/package.json", "packages/core/tests/build/prerelease.test.ts"]
hits: 1
last-hit: 2026-11-15
evidence: ["roadmap 1"]
---

# Raise a peer floor only once that peer is on npm

## Mistake
Backend rc.29 raised its clients peer floor to rc.29 while clients rc.29 was unpublished, so the packed consumer install failed ERESOLVE. Clients then moved onto backend rc.29 without updating its conformance app for the new checks, and its CI went red twice.

## Fix
Release backend with the old peer floor. Bump clients onto that backend from npm and fix its conformance app until clients CI is green, then tag clients. Only after `npm view` shows clients, pin it in core and raise the peer floor with prerelease.test.ts in one commit.
