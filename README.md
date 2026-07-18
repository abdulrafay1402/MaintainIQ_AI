# MaintainIQ

AI-Powered QR Maintenance & Asset History Platform — Track A (Batch 16 & 17) full-stack implementation with separated backend and frontend.

**Scan. Report. Diagnose. Maintain.**

## Stack

- Backend: Node.js, Express, Mongoose, JWT, bcrypt, Multer, Nodemailer, express-rate-limit
- Frontend: React 18, React Router, TanStack Query, React Hook Form, Tailwind CSS v4, Vite
- Database: MongoDB Atlas
- AI: Google Gemini (structured JSON output) with a rule-based fallback when the API is unavailable

## Mandatory scope covered

- Authentication with Student (reporter), Admin, and Technician roles; **all authorization enforced on the backend**
- Public registration creates student accounts only; technicians/admins are onboarded by an admin from the Staff page
- Asset registration with unique code, category, location, building/floor/room, condition, status, purchase/service dates, and assigned technician
- Asset list with search + filters (status, category, location, technician, condition)
- Automatic QR generation encoding a **stable public URL based on an immutable `publicId`** — editing the asset name, location, or code never breaks printed QR labels
- QR preview, **download-to-PNG**, copy public link, open public page, **print-ready asset label**, and **bulk QR label sheet** (respects current filters)
- Safe, mobile-friendly public asset page: name, code, category, location, condition, status, **last/next service dates**, safe recent activity, and Report Issue — no private notes, serials, costs, or user data
- Retired assets stay readable with a **prominent Retired banner** (reporting disabled); invalid codes show a proper not-found state
- Public issue reporting with **image evidence upload** (up to 5 photos, validated server-side), unique issue numbers, automatic asset status update
- **AI Issue Triage**: structured title/category/priority/causes/safe checks/safety warning; user reviews and edits before submitting; graceful timeout/fallback handling; whether the AI suggestion was reviewed is stored
- Assignment (direct or AI expertise-matched recommendation), shared technician pool with claim, controlled status workflow with invalid transitions blocked server-side
- Maintenance records: notes, parts, cost (non-negative), start/completion dates, next-service validation, findings, work performed, duration, final condition, evidence
- **AI post-maintenance summary + preventive recommendation**
- Permanent, immutable asset history timeline (model-level protection against edits/deletes) and per-issue status timeline
- **In-app notifications** (bell with unread badge) + optional **email alerts** on report/assign/resolve when SMTP is configured
- **Rate limiting** on auth, public reporting, and the AI triage endpoint
- Role-specific dashboards with useful operational summary cards (including real average repair time for technicians)
- Responsive frontend, API documentation (see `API.md`), demo credentials below

## Demo accounts

Run the seed script after connecting MongoDB:

```bash
cd backend
npm run seed            # idempotent — adds demo users/assets, keeps existing data
npm run seed -- --fresh # wipes assets/issues/history first, then seeds a full demo dataset
```

Seeded credentials (pre-verified, no OTP email needed):

- Admin: `admin@maintainiq.local` / `Admin@123`
- Technician: `tech@maintainiq.local` / `Tech@123` (expertise: Electronics / IT, Electrical)
- Technician: `tech2@maintainiq.local` / `Tech@123` (expertise: HVAC, Plumbing)
- Student: `student@maintainiq.local` / `Student@123`
- Students can also self-register from the Sign up page (staff accounts are onboarded by an admin only)

## Setup

1. Install dependencies in `backend/` and `frontend/` (`npm install` in each).
2. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` and `JWT_SECRET`. Optional: `GEMINI_API_KEY` (AI), `SMTP_USER`/`SMTP_PASS` (email alerts).
3. Copy `frontend/.env.example` to `frontend/.env` if you want to change the API URL.
4. Start the backend: `npm run dev` inside `backend/` (http://localhost:5000).
5. Start the frontend: `npm run dev` inside `frontend/` (http://localhost:5173).
6. Seed demo data: `npm run seed` inside `backend/`.
7. Run tests: `npm test` inside `backend/`.

Or from the repo root: `npm run dev` starts both.

## Demo flow (matches the hackathon scenario)

1. Log in as admin → Equipment → register "Classroom Projector 01" → QR is generated automatically; download it or open **Print label**.
2. Scan the QR (or open the public link) → the safe public page shows the asset with service dates.
3. Type the complaint ("The projector display is flickering and sometimes does not detect HDMI") → **Generate AI triage** → review/edit the suggestion → attach photo evidence → submit.
4. Admin sees the complaint (with AI diagnosis and evidence), gets a notification, and assigns the recommended technician.
5. Technician starts inspection → records damaged HDMI cable, replacement part, cost, duration → resolves.
6. Asset returns to Operational, service dates update, permanent history and the issue timeline record everything, and the AI maintenance summary + preventive recommendation appear.

## Deployment (Vercel)

Both apps deploy to Vercel. **These environment variables are mandatory in production:**

| App | Variable | Value |
|---|---|---|
| Frontend | `VITE_API_URL` | `https://<your-backend>.vercel.app/api` |
| Backend | `CLIENT_URL` | `https://<your-frontend>.vercel.app` (drives QR codes **and** CORS) |
| Backend | `MONGODB_URI`, `JWT_SECRET`, `CLOUDINARY_*` | same as local |
| Backend | `GEMINI_API_KEY` | free key from https://aistudio.google.com/apikey |
| Backend | `SMTP_USER`, `SMTP_PASS` | Gmail app password for OTP/notification emails |

## Notes

- Evidence images are uploaded to Cloudinary via `backend/src/middleware/upload.js` (5 images max, 5MB each, images only — validated server-side).
- Public asset pages and reporter issue views use dedicated safe DTOs so private fields can never leak.
- AI triage understands English, Urdu, and Roman Urdu complaints, includes a recurring-failure warning built from the asset's history, and falls back to a rule-based classifier if Gemini is unavailable (8s timeout).
- The issue workflow (`Reported → Assigned → Inspection Started → …`) is enforced server-side; the UI only offers legal next transitions.
