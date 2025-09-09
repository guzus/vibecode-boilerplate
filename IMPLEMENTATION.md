# Boilerplate — Next.js (Netlify) + Cloud Run API (R2 + Firebase)

**Folders:** `frontend/` + `backend/` • **Runtime:** Node 22

---

## 0) Scope

- **Frontend:** Next.js 14 (App Router, TS) → Netlify
- **Backend:** Fastify (TS) on GCP Cloud Run
- **Storage:** Cloudflare R2 (S3-compatible)
- **Auth/DB:** Firebase Auth (+ Firestore optional)
- **Package manager:** pnpm (optional but recommended)

---

## 1) Repo Layout

```
/
├─ frontend/                # Next.js app → Netlify
│  ├─ .nvmrc                # 22
│  ├─ netlify.toml
│  └─ ...
├─ backend/                 # Fastify API → Cloud Run
│  ├─ .nvmrc                # 22
│  ├─ Dockerfile
│  └─ src/
└─ README.md
```

**Optional root for convenience:**
- `pnpm-workspace.yaml` — if using pnpm workspaces
- `package.json` — dev scripts to run both apps

---

## 2) Frontend (Next.js → Netlify)

### frontend/.nvmrc
```
22
```

### frontend/netlify.toml
```toml
[build]
command = "corepack enable && pnpm i --frozen-lockfile && pnpm build"
publish = ".next"

[build.environment]
NODE_VERSION = "22"

[[plugins]]
package = "@netlify/plugin-nextjs"
```

**Env (Netlify Site settings → Environment):**
- `NEXT_PUBLIC_API_BASE_URL=https://<cloud-run-service-url>`

**Notes:**
- Use App Router. No serverless API here; all data goes to Cloud Run via `NEXT_PUBLIC_API_BASE_URL`.
- For preview deploys, point `NEXT_PUBLIC_API_BASE_URL` to staging API.

---

## 3) Backend (Fastify on Cloud Run, Node 22)

### backend/.nvmrc
```
22
```

### backend/src/server.ts
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authMiddleware } from './services/firebase';
import { r2 } from './services/r2';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get('/healthz', async () => ({ ok: true }));

app.get('/me', { preHandler: authMiddleware }, async (req: any) => {
  return { uid: req.user.uid };
});

app.get('/uploads/presign', { preHandler: authMiddleware }, async (req: any) => {
  const key = `users/${req.user.uid}/${Date.now()}.bin`;
  const url = await r2.getSignedPutUrl(process.env.R2_BUCKET_NAME!, key);
  return { key, url };
});

const port = Number(process.env.PORT) || 8080;
app.listen({ port, host: '0.0.0.0' });
```

### backend/src/services/r2.ts
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
  },
  forcePathStyle: true
});

export const r2 = {
  getSignedPutUrl: (Bucket: string, Key: string) =>
    getSignedUrl(client, new PutObjectCommand({ Bucket, Key }), { expiresIn: 900 })
};
```

### backend/src/services/firebase.ts
```typescript
import admin from 'firebase-admin';

if (!admin.apps.length) {
  // Prefer Workload Identity on Cloud Run (no key json).
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

export const authMiddleware = async (req: any, reply: any) => {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return reply.code(401).send({ error: 'missing token' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
  } catch {
    return reply.code(401).send({ error: 'invalid token' });
  }
};
```

### backend/Dockerfile (Node 22)
```dockerfile
FROM node:22-slim
WORKDIR /srv

# Install deps (adjust if using pnpm)
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm i --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

ENV PORT=8080
CMD ["node", "dist/server.js"]
```

**Deployment gotcha:** If you use Cloud Build, reference the correct Dockerfile path:
`-f backend/Dockerfile` (to avoid "/workspace/Dockerfile: no such file or directory").

---

## 4) Environment Variables

**Frontend (Netlify)**
- `NEXT_PUBLIC_API_BASE_URL`

**Backend (Cloud Run)**
- `FIREBASE_PROJECT_ID`
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`
- **Secrets via Secret Manager:** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

**Local dev**
- `frontend/.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`
- `backend/.env`: mirror backend vars; when using emulators:
  - `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`
  - `FIRESTORE_EMULATOR_HOST=localhost:8081` (if using Firestore locally)

---

## 5) CI/CD

### A) GitHub Actions → Cloud Run (backend)

**.github/workflows/backend-cloudrun.yml**
```yaml
name: backend-cloudrun
on:
  push:
    branches: [ main ]
    paths: [ "backend/**" ]

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    permissions: { id-token: write, contents: read }
    steps:
      - uses: actions/checkout@v4

      - uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
          service_account: ${{ secrets.GCP_SA_EMAIL }}

      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker ${{ secrets.GCP_ARTIFACT_REGION }}-docker.pkg.dev

      - name: Build & push
        run: |
          IMAGE=${{ secrets.GCP_ARTIFACT_REGION }}-docker.pkg.dev/${{ secrets.GCP_PROJECT }}/api/backend:${{ github.sha }}
          docker build -f backend/Dockerfile -t $IMAGE .
          docker push $IMAGE
          echo "IMAGE=$IMAGE" >> $GITHUB_ENV

      - name: Deploy
        run: |
          gcloud run deploy backend \
            --project ${{ secrets.GCP_PROJECT }} \
            --region ${{ secrets.GCP_REGION }} \
            --image $IMAGE \
            --platform managed \
            --allow-unauthenticated \
            --set-env-vars FIREBASE_PROJECT_ID=${{ secrets.FIREBASE_PROJECT_ID }},R2_ACCOUNT_ID=${{ secrets.R2_ACCOUNT_ID }},R2_BUCKET_NAME=${{ secrets.R2_BUCKET_NAME }} \
            --set-secrets R2_ACCESS_KEY_ID=R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY:latest
```

**Repo secrets required:**
- `GCP_PROJECT`, `GCP_REGION`, `GCP_ARTIFACT_REGION`
- `GCP_WIF_PROVIDER`, `GCP_SA_EMAIL`
- `FIREBASE_PROJECT_ID`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`
- **Secret Manager entries:** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

### B) Netlify (frontend)
- Connect site to `frontend/` folder.
- Build command from `netlify.toml`.
- Env: `NEXT_PUBLIC_API_BASE_URL`.
- Ensure Node 22 via `NODE_VERSION` or `.nvmrc`.

### C) (Optional) Cloud Build trigger (backend)

Use `infra/cloudbuild.yaml` with:

```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "-f", "backend/Dockerfile", "-t", "$_IMAGE", "."]
  - name: gcr.io/cloud-builders/docker
    args: ["push", "$_IMAGE"]
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args: [
      "run","deploy","backend",
      "--image","$_IMAGE",
      "--region","$_REGION",
      "--platform","managed",
      "--allow-unauthenticated",
      "--set-env-vars","FIREBASE_PROJECT_ID=$_FIREBASE_PROJECT_ID,R2_ACCOUNT_ID=$_R2_ACCOUNT_ID,R2_BUCKET_NAME=$_R2_BUCKET_NAME",
      "--set-secrets","R2_ACCESS_KEY_ID=R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY:latest"
    ]
substitutions:
  _REGION: "asia-northeast3"
  _IMAGE: "asia-northeast3-docker.pkg.dev/$PROJECT_ID/api/backend:$SHORT_SHA"
  _FIREBASE_PROJECT_ID: "your-firebase-project"
  _R2_ACCOUNT_ID: "your-r2-account"
```

---

## 6) R2 Setup
- Create bucket, generate S3 API token with write scope.
- CORS on bucket: allow PUT from your Netlify domain and GET if public.
- Flow: frontend requests `/uploads/presign` → browser PUTs directly to R2 with returned URL.

---

## 7) Firebase Setup
- Enable providers in Firebase Auth.
- On Cloud Run, use Workload Identity (no JSON key file). Grant service account:
  - `roles/iam.serviceAccountUser` (if needed)
  - `roles/datastore.user` (if using Firestore)
- Frontend gets ID token from Firebase SDK → send `Authorization: Bearer <idToken>`.

---

## 8) Local Dev

**Option A — simple (two terminals)**
```bash
# Terminal 1
cd backend && corepack enable && pnpm i && pnpm dev

# Terminal 2
cd frontend && corepack enable && pnpm i && pnpm dev
```

**Option B — root scripts (optional)**

`package.json` at repo root:
```json
{
  "packageManager": "pnpm@9",
  "scripts": {
    "dev:frontend": "pnpm --dir frontend dev",
    "dev:backend": "pnpm --dir backend dev",
    "dev": "concurrently -n FE,BE -c auto \"pnpm --dir frontend dev\" \"pnpm --dir backend dev\""
  },
  "devDependencies": { "concurrently": "^9.0.0" }
}
```

---

## 9) Minimal frontend usage example

```typescript
// e.g., frontend/app/page.tsx
const api = process.env.NEXT_PUBLIC_API_BASE_URL!;
const res = await fetch(`${api}/healthz`, { cache: 'no-store' });
```

---

## 10) Ops notes
- **Health check:** GET `/healthz`
- Consider `--min-instances=1` on Cloud Run to reduce cold starts.
- Log with structured JSON; rely on Cloud Run Logs Explorer.
- Keep R2 keys only in Secret Manager.