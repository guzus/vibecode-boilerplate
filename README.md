# Vibecode Boilerplate

Production-ready boilerplate with Next.js frontend and Fastify backend, deployed to Netlify and Google Cloud Run.

## Architecture

- **Frontend:** Next.js 14 (App Router) → Netlify
- **Backend:** Fastify API → Cloud Run
- **Auth:** Firebase Authentication
- **Storage:** Cloudflare R2 (S3-compatible)
- **Runtime:** Node.js 22

## Quick Start

### Prerequisites

- Node.js 22+ (use `nvm use` to switch)
- pnpm (`corepack enable`)
- Firebase project
- Cloudflare R2 bucket
- GCP project (for Cloud Run)

### Local Development

1. **Clone and install:**
```bash
git clone <your-repo>
cd vibecode-boilerplate
corepack enable
pnpm install:all
```

2. **Set up environment variables:**

Frontend (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
```

Backend (`backend/.env`):
```env
PORT=8080
FIREBASE_PROJECT_ID=your-project
R2_ACCOUNT_ID=your-account
R2_BUCKET_NAME=your-bucket
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
```

3. **Run both apps:**
```bash
pnpm dev
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:8080

## Deployment

### Frontend (Netlify)

1. Connect your GitHub repo to Netlify
2. Set base directory to `frontend`
3. Add environment variables in Netlify dashboard
4. Deploy automatically on push to main

### Backend (Cloud Run)

1. Set up GitHub secrets (see `.github/workflows/backend-cloudrun.yml`)
2. Create GCP service account with Cloud Run permissions
3. Configure Workload Identity Federation
4. Push to main branch triggers automatic deployment

## Project Structure

```
/
├── frontend/           # Next.js application
│   ├── app/           # App Router pages
│   ├── lib/           # Utilities (Firebase, API client)
│   └── components/    # React components
│
├── backend/           # Fastify API
│   ├── src/          
│   │   ├── services/  # Firebase, R2 integrations
│   │   └── server.ts  # Main server file
│   └── Dockerfile    
│
└── .github/          
    └── workflows/     # CI/CD pipelines
```

## Features

- ✅ TypeScript throughout
- ✅ Firebase Authentication
- ✅ Cloudflare R2 file uploads
- ✅ Health checks
- ✅ CORS configured
- ✅ Docker containerization
- ✅ GitHub Actions CI/CD
- ✅ Environment-based configuration

## API Endpoints

- `GET /healthz` - Health check
- `GET /me` - Get authenticated user (requires auth)
- `GET /uploads/presign` - Get presigned upload URL (requires auth)

## Scripts

**Root level:**
- `pnpm dev` - Run both frontend and backend
- `pnpm build` - Build both apps
- `pnpm install:all` - Install dependencies for both apps

**Frontend:**
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Type checking

**Backend:**
- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Compile TypeScript
- `pnpm start` - Run production build
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Type checking

## License

MIT
