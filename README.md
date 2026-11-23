# Lamina Forge (`lamina-forge`)

A Meshy-inspired AI 3D asset generation studio powered by **Microsoft TRELLIS.2-4B** (`microsoft/TRELLIS.2-4B`), featuring a modular FastAPI backend that runs on **Google Colab (L4/A100 GPU via Cloudflare Tunnel)** for free local testing and deploys cleanly to **Google Cloud Run (L4 GPU, scale-to-zero)** or **fal.ai**.

## Architecture

```
lamina-forge/
├── frontend/                              # React 18 + Vite + TypeScript + Tailwind + R3F
├── backend/                               # FastAPI inference & mesh post-processing server
│   ├── main.py                            # Unified REST API + MOCK_MODE procedural GLB fallback
│   ├── trellis_runner.py                  # Microsoft TRELLIS.2-4B pipeline & rembg wrapper
│   ├── postprocess.py                     # trimesh / Blender cleanup, pivot, decimation, Draco GLB
│   ├── requirements.txt
│   └── Dockerfile                         # CUDA 12.4 Cloud Run L4 scale-to-zero container
└── notebooks/
    └── Lamina_Forge_Colab_Worker.ipynb    # One-click Colab L4/A100 worker + Cloudflare Tunnel
```

## Quick Start (Local Mock Mode)

### 1. Start the Backend (`MOCK_MODE=true`)
```bash
cd backend
uv venv && uv pip install -r requirements.txt
MOCK_MODE=true uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
On Windows PowerShell:
```powershell
cd backend
$env:MOCK_MODE="true"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. By default, `frontend/.env` points to `http://localhost:8000`.

## Running with Google Colab GPU (Free L4 / A100)
1. Open `notebooks/Lamina_Forge_Colab_Worker.ipynb` in Google Colab.
2. Select **Runtime → Change runtime type → L4 GPU** (or A100).
3. Run all cells. The final cell starts the FastAPI server and prints a public `https://*.trycloudflare.com` URL.
4. Click the **Backend Status** pill in the Lamina Forge top bar and paste the Cloudflare Tunnel URL (or put it in `frontend/.env` as `VITE_API_URL`).

## Deploying to Google Cloud Run (L4 GPU, Scale-to-Zero)
```bash
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT/lamina-forge-backend
gcloud run deploy lamina-forge-backend \
  --image gcr.io/YOUR_PROJECT/lamina-forge-backend \
  --region europe-west4 \
  --gpu 1 \
  --gpu-type nvidia-l4 \
  --cpu 4 \
  --memory 16Gi \
  --min-instances 0 \
  --max-instances 2 \
  --timeout 600 \
  --no-cpu-throttling \
  --allow-unauthenticated
```
