# QA Report — SBApp (Southern Bay Construction Project Manager)
**Date:** 2026-05-09  
**Duration:** ~45 min  
**Branch:** main  
**Tier:** Standard (full exploration, no fixes required)  
**Pages tested:** Homepage, Project Detail (PM view), Customer Portal, Customer Sign flow  
**Framework detected:** Node.js/Express + static HTML/JS SPA (SQLite via @libsql/client)  
**Screenshots:** `.gstack/qa-reports/screenshots/`

---

## Health Score

| Category | Score | Weight | Weighted |
|----------|-------|--------|---------|
| Console | 90 | 15% | 13.5 |
| Links | 100 | 10% | 10.0 |
| Visual | 95 | 10% | 9.5 |
| Functional | 97 | 20% | 19.4 |
| UX | 85 | 15% | 12.75 |
| Performance | 100 | 10% | 10.0 |
| Content | 90 | 5% | 4.5 |
| Accessibility | 75 | 15% | 11.25 |
| **TOTAL** | | | **90.9 / 100** |

**Baseline health score: 91**

---

## Top 3 Things to Fix

1. **ISSUE-001 (Low) — `prompt()` clipboard fallback is unpolished** — "Share Link" copies via `navigator.clipboard` but falls back to `window.prompt()`, which shows a native browser dialog. Should be a styled toast instead.
2. **ISSUE-002 (Low) — Photo upload accepts any file type** — `<input type="file">` has no `accept` attribute; users get no pre-submit feedback if they select a non-image file. Server-side validation is the only gate.
3. **ISSUE-003 (Low) — Console 404 on invalid token** — `GET /api/customer/invalidtoken123 → 404` surfaces in DevTools during the invalid-token flow. The UI handles it gracefully (error message shows), but the console noise is avoidable with a try/catch response check before logging.

---

## Issues Found

### ISSUE-001 — `prompt()` clipboard fallback in Share Link
**Severity:** Low  
**Category:** UX  
**Status:** Open  
**Page:** Project Detail (`/`)

**Repro:**
1. Open a project card → click "Share Link"
2. In a browser where `navigator.clipboard` is unavailable (non-HTTPS, certain Firefox configs) → native `window.prompt()` dialog appears with the URL to manually copy

**Evidence:** `screenshots/customer-portal.png` (shows the portal URL; the prompt appears in restricted clipboard environments)

**Root cause:** `copyCustomerLink()` in `public/index.html:2291` — `navigator.clipboard.writeText().catch()` falls back to `window.prompt('Copy this link:', url)`.

**Fix needed:** Replace `window.prompt` fallback with a styled inline "Copied!" toast that fades out after 2 seconds, or a visible URL display beneath the button.

---

### ISSUE-002 — Photo upload accepts any file type
**Severity:** Low  
**Category:** UX / Validation  
**Status:** Open  
**Page:** Project Detail → Add Photo modal

**Repro:**
1. Open project → click photo area → Add Photo modal opens
2. Select a non-image file (e.g., `.pdf`, `.docx`) → submit
3. No pre-submit client-side warning about file type

**Root cause:** `<input type="file">` in the photo modal has no `accept` attribute to restrict MIME types. Server-side validation handles it, but the user gets no early feedback.

**Fix needed:** Add `accept="image/*"` (or `accept=".jpg,.jpeg,.png,.gif,.webp"`) to the file input. Optionally add client-side preview.

---

### ISSUE-003 — Console 404 during invalid token flow
**Severity:** Low  
**Category:** Console / DX  
**Status:** Open  
**Page:** Customer portal with invalid token (`/c/invalidtoken123`)

**Repro:** Navigate to `/c/[bad-token]` → DevTools console shows `Failed to load resource: 404 (Not Found)` for `/api/customer/[bad-token]`.

**Root cause:** `customer.html` fetches the API endpoint unconditionally and the 404 propagates to the console error handler without being caught as an expected "not found" case.

**Fix needed:** In the fetch response handler, treat 404 as an expected "invalid token" state and skip `console.error` — the UI already shows an error message to the user.

---

## Flows Tested (All Passing)

### Homepage — Project List
- Loaded 2 project cards (Smith Residence, Johnson Kitchen & Bath) ✅
- Card metadata (client name, address, dates, crew) renders correctly ✅
- Task progress bar shows 0/90 (0%) and 0/68 (0%) ✅
- Approved CO badge ("✓ 1 approved") shows on Smith Residence ✅
- "+ New Project" button visible in nav ✅

**Evidence:** `screenshots/initial.png`

---

### Project Detail — PM View
- All 6 action buttons render: Edit Info, Share Link, Budget, Change Orders, Add Photo, Add Decision ✅
- Phase accordion expands/collapses tasks ✅
- Task checkbox toggles from unchecked → checked, progress updates (0/90 → 1/90) ✅
- "Customer View" toggle hides internal fields ✅

**Evidence:** `screenshots/project-detail.png`, `screenshots/task-toggle.png`

---

### Edit Info Modal
- Opens on button click (`openEditInfoModal()`) ✅
- Pre-populates existing project data ✅
- Requires `STATE.currentProject` to be set (correct guard) ✅

---

### Share Link (Customer Link)
- `POST /api/projects/:id/customer-link` returns a unique hex token ✅
- Copies URL to clipboard (or shows prompt fallback — see ISSUE-001) ✅

---

### Change Order Modal — PM Submission
- Opens via "Change Orders" button ✅
- Validates empty title (inline error) ✅
- Validates empty amount (inline error) ✅
- Validates non-numeric amount ✅
- Full submission: `POST /api/projects/:id/cos → 200` ✅
- Change order appears in CO list after submission ✅

**Evidence:** `screenshots/change-order-modal.png`, `screenshots/co-submit-empty.png`, `screenshots/co-submitted.png`

---

### Add Photo Modal
- Opens photo modal ✅
- Empty submission shows validation message ✅
- File type not pre-validated (see ISSUE-002) ✅

**Evidence:** `screenshots/photo-modal.png`, `screenshots/photo-no-file-submit.png`

---

### New Project Wizard (2-step)
- Step 1: Project name required (validation fires on empty) ✅
- Step 1 → Step 2 on valid name ✅
- Step 2: Client name, address, date fields ✅
- `POST /api/projects → 201` on submit ✅

**Evidence:** `screenshots/new-project-modal.png`, `screenshots/new-project-step2.png`, `screenshots/new-project-no-name.png`

---

### Customer Portal (`/c/:token`)
- Serves client-facing simplified view ✅
- Shows project info, timeline, approved COs ✅
- "Review & Sign" button visible on pending COs ✅

**Evidence:** `screenshots/customer-portal.png`

---

### CO Review & Sign Flow
- Sign modal opens from customer portal ✅
- Name validation: empty name blocks submission ✅
- Valid name → `POST /api/customer/:token/cos/:id/sign → 200` ✅
- CO status updates to "signed" in UI ✅

**Evidence:** `screenshots/co-sign-modal.png`, `screenshots/co-sign-no-name.png`, `screenshots/co-signed.png`

---

### Invalid Token Error Page
- `GET /api/customer/invalidtoken123 → 404` ✅
- UI shows clean error message (no raw JSON or stack trace) ✅

**Evidence:** `screenshots/invalid-token.png`

---

### Responsive Layout
- **Mobile (375px):** cards stack, nav readable, "+ New Project" button visible ✅
- **Tablet (768px):** single column, all card metadata legible ✅
- **Desktop (1280px):** two-column card grid, full-width header ✅

**Evidence:** `screenshots/responsive-mobile.png`, `screenshots/responsive-tablet.png`, `screenshots/responsive-desktop.png`

---

## Console Health

| State | Console Errors |
|-------|---------------|
| Initial load | ✅ None |
| Project detail | ✅ None |
| Change order submit | ✅ None |
| Task toggle | ✅ None |
| New project create | ✅ None |
| Customer portal (valid token) | ✅ None |
| CO sign flow | ✅ None |
| Invalid token (`/c/invalidtoken123`) | ⚠️ 1 expected 404 (correct behavior, noisy console) |

---

## Performance

| Metric | Value |
|--------|-------|
| DNS | 0ms |
| TCP | 2ms |
| TTFB | 1ms |
| DOM Parse | 20ms |
| DOM Ready | 28ms |
| Load | 38ms |
| **Total** | **38ms** |

Excellent. Express serves pre-built HTML; no bundler overhead at runtime. Google Fonts load asynchronously and don't block render.

---

## Links Health

All internal API routes resolve correctly. No dead nav links. Customer token URLs are single-use paths generated server-side.

---

## Test Data Left in DB

The following data was created during QA and remains in the local SQLite database:

| Type | Project | Data |
|------|---------|------|
| Change Order | Johnson Kitchen & Bath (id=2) | "QA Test Change Order" — $500 — **signed** |
| Task toggle | Smith Residence (id=1) | Task #1 set to checked (1/90) |

To reset: restart the server with a fresh DB, or manually `DELETE FROM change_orders WHERE title = 'QA Test Change Order'` and reset the task.

---

## Deferred Issues

| Issue | Severity | Reason |
|-------|----------|--------|
| ISSUE-001: prompt() clipboard fallback | Low | UX polish — no blocking impact |
| ISSUE-002: Photo upload no file type filter | Low | Server validates; low user friction |
| ISSUE-003: Console 404 on invalid token | Low | Expected behavior; cosmetic |

---

## Summary

- **Issues found:** 3 (all Low severity)
- **Fixed:** 0 (no blocking bugs)
- **Deferred:** 3
- **Health score:** 91/100

SBApp is well-built. All primary user journeys work end-to-end with no blocking bugs: PM creates projects and change orders, customer reviews and signs COs, task progress tracks correctly, and invalid tokens fail gracefully. The three findings are polish items, not blockers. The app is ready for production use with the caveat that the photo upload and clipboard fallback should be addressed before heavy customer-facing use.
