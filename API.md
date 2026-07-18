# MaintainIQ API Documentation

Base URL: `http://localhost:5000/api` (production: `https://<backend>.vercel.app/api`)

Authentication: JWT via `Authorization: Bearer <token>` header **or** the httpOnly `token` cookie set at login.
All error responses: `{ "message": "<reason>" }` with an appropriate HTTP status.

Roles: `admin`, `technician`, `student` (reporter). Authorization is enforced on the server for every route below.

---

## Auth — `/auth`

| Method | Route | Access | Body | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | Public | `name, email, password, studentId` | **Student accounts only** (staff onboarded by admin). Sends OTP email; responds `{ status: "verification_pending", emailSent }`. Rate-limited (30/15min). |
| POST | `/auth/login` | Public | `email, password` | Verified users without 2FA get `{ token, user }` + cookie. Unverified/2FA users get `verification_pending` + OTP email. |
| POST | `/auth/verify-otp` | Public | `email, code` | Verifies the 6-digit OTP (10 min expiry) and returns `{ token, user }`. |
| POST | `/auth/resend-otp` | Public | `email` | Re-sends OTP. 502 if the email cannot be sent. |
| POST | `/auth/forgot-password` | Public | `email` | Sends a reset code (15 min expiry). |
| POST | `/auth/reset-password` | Public | `email, code, newPassword` | Resets the password. |
| POST | `/auth/logout` | Public | — | Clears the auth cookie. |
| GET | `/auth/me` | Authenticated | — | Full profile: `id, name, email, role, phone, department, studentId, expertise, twoFactorEnabled`. |

## Users — `/users`

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | `/users/technicians` | Admin | Active technicians with expertise tags. |
| GET | `/users` | Admin | All active users. |
| POST | `/users` | Admin | Onboard `admin` or `technician` (`name, email, password, role, expertise[]`). Credentials + OTP emailed; response includes `emailSent`. |
| PATCH | `/users/profile` | Authenticated | Update own `name, phone, department, twoFactorEnabled`. |
| PATCH | `/users/change-password` | Authenticated | `currentPassword, newPassword` (min 6 chars). |

## Assets — `/assets`

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | `/assets/public/:code` | **Public** | Safe DTO by immutable `publicId` or asset code — no serials, notes, costs, or user data. Includes safe recent activity. |
| GET | `/assets/public/:code/qr` | **Public** | `{ publicUrl, qrCodeDataUrl, publicId }`. |
| GET | `/assets` | Authenticated | Filters: `search, status, category, location, assignedTechnician(\|unassigned)`. Sort: `sort=newest\|oldest\|name\|name-desc\|code\|status\|next-service`. |
| POST | `/assets` | Admin | Requires `name, code, category, location`. **Duplicate codes rejected.** Auto-generates immutable `publicId` + QR. Creates history entry. |
| GET | `/assets/:id` | Authenticated | Full asset + QR + 5 recent issues. |
| PATCH | `/assets/:id` | Admin | `publicId` is immutable — QR mapping never breaks on edits. |
| GET | `/assets/:id/qr` | Authenticated | QR payload for the asset. |

Asset statuses: `Operational, Issue Reported, Under Inspection, Under Maintenance, Out of Service, Retired, Faulty`.

## Issues — `/issues`

| Method | Route | Access | Notes |
|---|---|---|---|
| POST | `/issues/public/:code/report` | **Public** (rate-limited 20/h) | multipart/form-data: `title, description, category, reporterName` required; `priority, reporterEmail, studentId, aiSuggestion`, up to 5 image `evidence` files (5MB each, Cloudinary). **Retired assets reject new reports.** Generates unique issue number, flips asset to `Issue Reported`, notifies admins, writes history. |
| POST | `/issues/triage` | **Public** (rate-limited) | `{ assetCode, complaint }` → structured AI suggestion `{ title, category, priority, possibleCauses[], initialChecks[], warning, recurringPattern }`. Understands English/Urdu/Roman Urdu; 8s Gemini timeout with rule-based fallback. Advisory only — user reviews before submit. |
| GET | `/issues` | Authenticated | **Role-scoped:** admin = all (+filters), technician = own assigned (or `unassigned=true` pool), student = own reports only. Filters: `status, priority, category, location, search, sort`. |
| GET | `/issues/my` | Authenticated | Reports made by the current user. |
| GET | `/issues/assigned` | Technician | Issues assigned to the current technician. |
| GET | `/issues/:id` | Reporter/assigned tech/admin | Reporters receive a safe DTO (no internal fields). |
| GET | `/issues/:id/recommendations` | Admin | Expertise-matched technician ranking for assignment. |
| PATCH | `/issues/:id/assign` | Admin | `{ technicianId }` or `{ technicianId: "unassigned" }` to release to the shared pool. **Blocked on settled issues** (Resolved/Verified/Closed/Rejected/Cancelled). |
| PATCH | `/issues/:id/claim` | Technician/Admin | Claim an unassigned pool issue. Blocked on settled issues. |
| PATCH | `/issues/:id/status` | Admin/assigned tech | `{ status, note }`. **Transition graph enforced** (below). Resolving requires a note. Resolution triggers reporter notification + email. |
| POST | `/issues/:id/maintenance` | Admin/assigned tech | `{ notes*, cost≥0, startedAt≤completedAt*, nextServiceDate≥completedAt, partsUsed[], inspectionFindings, workPerformed, finalCondition, durationHours }`. Resolves the issue, updates asset service dates, creates an immutable MaintenanceRecord + history, generates the AI maintenance summary + preventive recommendation. Blocked on settled issues. |

### Issue status transition graph (server-enforced)

```
Reported            → Assigned | Rejected | Cancelled | Reopened
Assigned            → Inspection Started | Rejected | Reopened
Inspection Started  → Maintenance In Progress | Waiting for Parts | Reopened
Maintenance In Prog → Waiting for Parts | Resolved | Reopened
Waiting for Parts   → Maintenance In Progress | Resolved | Reopened
Resolved            → Verified | Closed | Reopened
Verified            → Closed | Reopened
Closed              → Reopened
Reopened            → Assigned | Inspection Started | Maintenance In Progress | Waiting for Parts | Resolved
Rejected, Cancelled → (terminal)
```

## History — `/history`

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | `/history/asset/:id` | Authenticated | Permanent timeline (actor, action, related issue). **Immutable at the model layer** — updates/deletes are blocked by Mongoose middleware. |

## Dashboard — `/dashboard`

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | `/dashboard/admin` | Admin | Stats + `statusDistribution` + `categoryDistribution` + recent issues. |
| GET | `/dashboard/student` | Authenticated | Own complaint stats + recents. |
| GET | `/dashboard/technician` | Technician/Admin | Assigned/pending/in-progress/completed + recents. |

## Notifications — `/notifications`

| Method | Route | Access | Notes |
|---|---|---|---|
| GET | `/notifications` | Authenticated | Latest 50 + `unreadCount`. |
| PATCH | `/notifications/:id/read` | Authenticated | Mark one as read (own only). |
| PATCH | `/notifications/read-all` | Authenticated | Mark all as read. |

## Business rules (enforced server-side)

- Duplicate asset codes are rejected (create and update).
- Retired assets stay publicly readable but cannot receive new reports.
- A technician may only update issues assigned to them; admins may update any.
- An issue cannot be resolved without a maintenance note; settled issues must be reopened before further edits.
- Maintenance cost and part costs/quantities cannot be negative; `NaN` is rejected.
- Next service date cannot be before the completion date; start date cannot be after completion.
- Every significant action writes an immutable asset-history entry.
- AI output is advisory: the reporter reviews/edits it, and `reviewedByUser` is stored with the issue.
