# Wellness 2

A B2B wellness marketplace that connects buyers (pharmacies/retailers) with suppliers (distributors/manufacturers). The platform supports catalog discovery, cart and checkout, and supplier order management in a modern, responsive UI.

## Features
- Buyer & supplier roles with role-specific screens
- Product catalog with category filters and search
- Cart and checkout flow
- Supplier dashboard for product management and order status updates
- Supabase auth, storage, and database-backed data

## Tech Stack
- Vite
- React + TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase (Auth, Postgres, Storage)

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- A Supabase project

### Installation
```bash
npm install
```

### Environment Setup
Copy the template and fill in your Supabase values:
```bash
cp .env.example .env
```

Set the following:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Run the App
```bash
npm run dev
```

### Lint & Tests
```bash
npm run lint
npm run test
```

## Deployment

### Vercel
- Import the GitHub repository
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
	- `VITE_SUPABASE_URL`
	- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Netlify
- New site from Git
- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables:
	- `VITE_SUPABASE_URL`
	- `VITE_SUPABASE_PUBLISHABLE_KEY`

## License
MIT
