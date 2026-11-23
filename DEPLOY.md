# Deploying Lamina Forge (Google Cloud Run L4 GPU + Vercel)

This guide deploys the **TRELLIS.2-4B GPU backend** to **Google Cloud Run** (NVIDIA L4, scale-to-zero) and the **React/Three.js Studio frontend** to **Vercel**.

---

## 1. Deploy GPU Backend to Google Cloud Run (NVIDIA L4)

### Prerequisites
- [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) authenticated (`gcloud auth login`)
- A GCP project with billing enabled and GPU quota for `nvidia-l4` in a supported region (e.g., `us-central1` or `europe-west4`)

### Set Project & Enable APIs
```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
export SERVICE_NAME="lamina-forge-api"
export IMAGE_URI="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

gcloud config set project "${PROJECT_ID}"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

### Build Container Image (Pre-Compiles `sm_89` CUDA Extensions)
`backend/Dockerfile` compiles `nvdiffrast`, `CuMesh`, `o-voxel`, and `FlexGEMM` for NVIDIA L4 (`TORCH_CUDA_ARCH_LIST="8.9"`) with `-std=c++20` and PyTorch native `SDPA` at build time so cold starts never compile CUDA kernels.

```bash
gcloud builds submit ./backend \
  --tag "${IMAGE_URI}" \
  --machine-type=e2-highcpu-8 \
  --timeout=45m
```

### Deploy to Cloud Run (Scale-to-Zero L4 GPU)
```bash
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_URI}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --cpu 8 \
  --memory 32Gi \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 1 \
  --timeout 300 \
  --port 8080 \
  --set-env-vars "MOCK_MODE=false,ATTN_BACKEND=sdpa,SPARSE_ATTN_BACKEND=sdpa"
```

> **Optional Secrets**: Add `GEMINI_API_KEY` (for Gemini Text-to-3D reference synthesis) or `HF_TOKEN` (if pulling gated Hugging Face repos) via `--set-env-vars` or Secret Manager.

Copy the printed Cloud Run service URL (e.g., `https://lamina-forge-api-xxxxx-uc.a.run.app`).

---

## 2. Deploy Studio Frontend to Vercel

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import the repository in [Vercel](https://vercel.com/new):
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - SPA routing is handled automatically by `frontend/vercel.json`.
3. Under **Environment Variables**, set:
   - `VITE_API_URL` = `https://lamina-forge-api-xxxxx-uc.a.run.app` (your Cloud Run URL, no trailing slash)
4. Click **Deploy**.

You can also override the backend URL at runtime anytime via **Settings** in the Lamina Forge top bar.
