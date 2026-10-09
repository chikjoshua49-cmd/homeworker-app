# Skillora

Skillora is a home-services marketplace that connects customers with trusted workers for everyday tasks. The platform is being built to launch in Zambia and scale to additional countries over time.

## Stack

- Backend: Node.js + Express + PostgreSQL
- Frontend: Flutter
- Auth: JWT + role-based access

## Repository structure

- `backend/` - Express API, PostgreSQL schema, migration and seed scripts
- `flutter_app/` - Flutter mobile application

## Backend setup

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

## Flutter setup

```bash
cd flutter_app
flutter pub get
flutter run
```

## Target launch market

- Zambia (initial launch)
- Expand regionally as the operational model matures

## Core product flow

1. Customer creates a job or service request
2. Workers apply or are selected
3. Booking is confirmed
4. Worker checks in/out
5. Customer confirms completion
6. Payment is released to worker
7. Commission is tracked and payouts are managed

## Notes

This repository currently contains the start of the API and a mobile app scaffold, designed for iterative development and expansion.
