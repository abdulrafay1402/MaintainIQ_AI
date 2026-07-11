# MaintainIQ

Track A (Batch 16 & 17) full-stack implementation with backend and frontend separated.

## Stack

- Backend: Node.js, Express, Mongoose, JWT, bcrypt
- Frontend: React, React Router, Vite
- Database: MongoDB Atlas

## Mandatory scope covered

- Authentication with Admin and Technician roles
- Backend-enforced authorization
- Asset registration with unique asset code
- Asset list, details, search, and filters
- Automatic QR generation linked to secure public asset routes
- Public issue reporting page
- Issue assignment and controlled status workflow
- Maintenance record with notes, parts, cost, dates, and evidence metadata
- Permanent asset history timeline
- Structured AI issue triage with human review
- Responsive frontend

## Demo accounts

Run the seed script after connecting MongoDB:

```bash
cd backend
npm run seed
```

Seeded credentials:

- Admin: `admin@maintainiq.local` / `Admin@123`
- Technician: `tech@maintainiq.local` / `Tech@123`

## Setup

1. Install dependencies in `backend/` and `frontend/`.
2. Copy `backend/.env.example` to `backend/.env` and add your MongoDB Atlas password.
3. Copy `frontend/.env.example` to `frontend/.env` if you want to change the API URL.
4. Start the backend with `npm run dev` inside `backend/`.
5. Start the frontend with `npm run dev` inside `frontend/`.
6. Seed demo data with `npm run seed` inside `backend/`.

## Notes

- Cloudinary is intentionally omitted for now, as requested.
- Evidence is represented as upload URLs/metadata so you can attach a storage provider later.
- Public asset pages remain safe and do not expose internal notes or admin controls.
