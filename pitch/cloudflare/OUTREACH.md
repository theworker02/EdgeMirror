# Cloudflare outreach — EdgeMirror acquisition / partnership

**Purpose:** Legitimate, one-shot professional contact so EdgeMirror diligence reaches Cloudflare partnerships / corpdev routing.  
**Rule:** Public channels only. No scraping personal inboxes. One message per channel.

## Published channels (researched)

| Channel | URL / address | Fit |
|---------|---------------|-----|
| Partner Network signup (official) | https://www.partners.cloudflare.com/partners/s/signup | Best form path; published `partners@cloudflare.com` on the same page |
| Partners hub | https://www.cloudflare.com/partners/ | Program overview (channel + technology alliances) |
| Technology Partner Program | https://www.cloudflare.com/partners/technology-partners/ | Integration / developer-services alliances |
| Partners inbox (published) | `partners@cloudflare.com` | Official “Questions? Contact us” address on partner signup |
| Startups program | https://www.cloudflare.com/startups/ · `startups@cloudflare.com` | Credits program — **not** used for acquisition pitch (wrong product) |
| Press | `press@cloudflare.com` | Press only — **not** used for M&A cold outreach |

**Not found:** A public Cloudflare corporate-development / M&A intake email. Acquisition interest is therefore routed via **partnerships** with an explicit ask to forward to corpdev / product partnerships.

## Email (sent or ready-to-send)

**To:** partners@cloudflare.com  
**Subject:** EdgeMirror — Workers local↔prod evidence layer (diligence / partnership or acquisition interest)

```
Hello Cloudflare Partnerships team,

I’m writing about EdgeMirror, an independent CLI that adds verify-before-deploy
differential evidence for Cloudflare Workers (local / workerd ↔ remote). It is
not affiliated with, endorsed by, or sponsored by Cloudflare.

Public materials for diligence:
• Repo: https://github.com/theworker02/EdgeMirror
• Acquisition brief: https://github.com/theworker02/EdgeMirror/blob/main/ACQUISITION.md
• Live demo: https://theworker02.github.io/EdgeMirror/

Positioning (honest): Wrangler and workerd are excellent and still not identical
to production. EdgeMirror ships CI/deploy gates and structured EM-### receipts so
teams fail merge or refuse deploy on divergence / insufficient evidence — and
returns REMOTE_NOT_CONFIGURED instead of fabricating MATCH when credentials are
missing. No captive usage metrics claimed.

Licensing: source-available proprietary; commercial/production use requires a
paid commercial license (COMMERCIAL.md). Open to partnership discussion or
acquisition / IP diligence under negotiated terms.

Please forward to corporate development or Workers platform / developer-
experience partnerships if that is a better inbox. Primary contact: GitHub
@theworker02.

Thank you,
theworker02
https://github.com/theworker02
```

## Partner form — what to submit

1. Open https://www.partners.cloudflare.com/partners/s/signup  
2. Prefer a **company / domain email** if the portal requires it (Gmail may be rejected).  
3. In free-text / product description, paste a shortened version of the email body above and link `ACQUISITION.md` + the live demo.  
4. Route as **Technology / Developer Services** alliance interest if asked for program type.

## Outreach log

| Date (UTC) | Channel | Action | Result |
|------------|---------|--------|--------|
| 2026-09-21 | Gmail draft → `partners@cloudflare.com` | Ready-to-send diligence / partnership+acquisition interest email created in authenticated Gmail | **Draft only** — user must review and Send |
| 2026-09-21 | Partner Network signup form | Documented at https://www.partners.cloudflare.com/partners/s/signup | **Manual** — portal often requires company-domain email |

**User next steps:** (1) Open Gmail Drafts, review the EdgeMirror message to `partners@cloudflare.com`, send once. (2) Optionally submit the Partner Network form with the same short pitch if you have a company email. Do not re-send to other Cloudflare addresses unless they reply with a better inbox.
