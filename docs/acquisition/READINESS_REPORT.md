# Acquisition Readiness Report — EdgeMirror

**Date:** 2026-09-21  
**No numeric score.** Statuses reflect evidence available in-repo and this program.

| Section | Status | Notes |
|---------|--------|-------|
| BUILD | READY | Verified in TEST_EVIDENCE.md (this program) |
| TESTS | READY | Verified in TEST_EVIDENCE.md (this program) |
| SECURITY | READY_WITH_DISCLOSURE | No SECRET_FOUND in tree scan. .env.example uses placeholders only. |
| DOCUMENTATION | READY_WITH_DISCLOSURE | Data room created this program |
| IP OWNERSHIP | REQUIRES_LEGAL_REVIEW | LICENSE copyright: theworker02. Historical Apache notice said 'EdgeMirror contributors'. Sole human … |
| LICENSE CLARITY | READY_WITH_DISCLOSURE | Current LICENSE clear; history documented; ETW revocation language corrected if applicable |
| DEPENDENCIES | READY_WITH_DISCLOSURE | npm: commander, js-yaml, picocolors, zod (MIT/ISC); stripe (MIT); wrangler/workerd (MIT OR Apache-2.… |
| THIRD-PARTY ASSETS | READY_WITH_DISCLOSURE / REQUIRES_LEGAL_REVIEW | See diligence |
| DATA RIGHTS | REQUIRES_LEGAL_REVIEW | Especially federated/operator/vendor data |
| REPRODUCIBILITY | READY_WITH_DISCLOSURE | BUYER_DEMO provided |
| TRANSFERABILITY | READY_WITH_DISCLOSURE | See TRANSFER_MANIFEST |
| OPERATIONS | READY_WITH_DISCLOSURE | Handoff + ops docs |
| BUYER DEMO | READY_WITH_DISCLOSURE | Commands verified where stack runnable; see TEST_EVIDENCE |
| KNOWN LIABILITIES | READY_WITH_DISCLOSURE | See DISCLOSURE_SCHEDULE |

## Blockers

### Before outreach
- Stale package-lock root version vs package.json 1.4.0
- SUPPORT.md missing (to be added)
- docs/acquisition was missing (this program)

### Before diligence
- REQUIRES_LEGAL_REVIEW: Apache→proprietary transition
- REQUIRES_LEGAL_REVIEW: Cursor co-authorship chain of title
- REQUIRES_LEGAL_REVIEW: LICENSE §5 assignment vs formal CLA

### Before signing
- Formal IP assignment / asset schedule
- Contributor/AI ownership opinion
- Cloudflare trademark use review for pitch materials

### Before closing
- Credential/account inventory migration checklist execution
- Registry transfer (npm) if applicable
- Executed SPA/APA
