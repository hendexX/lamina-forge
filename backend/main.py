"""
Lamina Forge — FastAPI Inference & Post-Processing Server
Supports:
  - MOCK_MODE=true (fast procedural .glb generation in ~2s for local UI testing)
  - Microsoft TRELLIS.2-4B on Google Colab (L4/A100 via Cloudflare Tunnel)
  - Google Cloud Run (L4 GPU, scale-to-zero)
  - Optional Gemini / Imagen Text-to-3D reference image synthesis
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from postprocess import (
    PresetType,
    export_mesh_format,
    generate_procedural_mock_glb,
)
from trellis_runner import MODEL_ID, TrellisRunner

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("lamina_forge.api")

MOCK_MODE = os.environ.get("MOCK_MODE", "false").lower() in ("1", "true", "yes")
OUTPUT_DIR = Path(os.environ.get("LAMINA_OUTPUT_DIR", Path(__file__).parent / "outputs"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Lamina Forge API",
    description="AI 3D Asset Generation Studio powered by Microsoft TRELLIS.2-4B",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

runner = TrellisRunner(model_id=MODEL_ID)

STAGES = [
    "Removing Background",
    "Generating O-Voxel Geometry",
    "Baking PBR Textures",
    "Optimizing Mesh",
]


@dataclass
class JobState:
    id: str
    status: str = "queued"  # queued | processing | completed | failed
    stage: str = "Queued"
    progress: int = 0
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    resolution: int = 1024
    target_tris: int = 25000
    preset: PresetType = "lamina_vet_anatomy"
    seed: int = 42
    prompt: Optional[str] = None
    glb_path: Optional[Path] = None
    metadata: Optional[dict] = None
    error: Optional[str] = None

    def to_response(self) -> dict:
        return {
            "id": self.id,
            "status": self.status,
            "stage": self.stage,
            "stages": STAGES,
            "progress": self.progress,
            "created_at": self.created_at,
            "completed_at": self.completed_at,
            "resolution": self.resolution,
            "target_tris": self.target_tris,
            "preset": self.preset,
            "seed": self.seed,
            "prompt": self.prompt,
            "download_url": f"/api/jobs/{self.id}/download" if self.status == "completed" else None,
            "metadata": self.metadata,
            "error": self.error,
        }


JOBS: Dict[str, JobState] = {}


class TextToImageRequest(BaseModel):
    prompt: str
    style: str = "studio_3d"


@app.get("/api/health")
async def health():
    device, gpu_name = runner.detect_hardware()
    return {
        "status": "ok",
        "mock_mode": MOCK_MODE,
        "model": MODEL_ID,
        "device": "mock" if MOCK_MODE else device,
        "gpu_name": "Mock Studio Engine" if MOCK_MODE else gpu_name,
        "version": "1.0.0",
    }


@app.post("/api/text-to-image")
async def text_to_image(
    req: TextToImageRequest,
    x_gemini_api_key: Optional[str] = Header(default=None),
):
    """
    Generate a clean studio-lit reference image on a neutral solid background
    using Gemini / Imagen API (or a deterministic studio SVG preview in MOCK_MODE).
    """
    api_key = x_gemini_api_key or os.environ.get("GEMINI_API_KEY", "").strip()
    studio_prompt = (
        f"3D asset render of {req.prompt}, single solid watertight object centered in frame, "
        f"three-quarter perspective view, matte-to-satin PBR materials, soft even studio lighting, "
        f"pure solid #FFFFFF background with zero glow, zero smoke, zero ground shadow, crisp silhouette."
    )

    if api_key:
        try:
            import urllib.request
            import json as _json

            url = (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-2.5-flash-image:generateContent?key={api_key}"
            )
            payload = _json.dumps(
                {
                    "contents": [{"parts": [{"text": studio_prompt}]}],
                    "generationConfig": {"responseModalities": ["IMAGE"]},
                }
            ).encode("utf-8")
            http_req = urllib.request.Request(
                url,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(http_req, timeout=45) as resp:
                data = _json.loads(resp.read().decode("utf-8"))
                parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                inline_data = next(
                    (p["inlineData"] for p in parts if isinstance(p, dict) and "inlineData" in p),
                    None,
                )
                if not inline_data or not inline_data.get("data"):
                    raise ValueError("No inlineData image returned by gemini-2.5-flash-image.")
                mime_type = inline_data.get("mimeType", "image/png")
                b64 = inline_data["data"]
                return {
                    "image_data_url": f"data:{mime_type};base64,{b64}",
                    "provider": "gemini-2.5-flash-image",
                    "prompt_used": studio_prompt,
                }
        except Exception as exc:
            logger.warning("Gemini image request failed (%s); falling back to mock studio preview.", exc)
            if not MOCK_MODE:
                raise HTTPException(status_code=502, detail=f"Gemini image API error: {exc}")

    # Deterministic studio-lit SVG reference preview for MOCK_MODE or key-free testing
    safe_label = req.prompt.strip()[:48].replace("<", "").replace(">", "").replace("&", "&amp;")
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="#F8FAFC"/>
      <stop offset="100%" stop-color="#E2E8F0"/>
    </radialGradient>
    <linearGradient id="sculpt" x1="20%" y1="15%" x2="80%" y2="85%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="50%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <ellipse cx="256" cy="390" rx="120" ry="24" fill="#94A3B8" opacity="0.35"/>
  <path d="M256 105 C330 115, 385 180, 365 260 C348 330, 300 375, 256 378 C210 375, 162 330, 147 260 C127 180, 182 115, 256 105 Z" fill="url(#sculpt)"/>
  <ellipse cx="222" cy="188" rx="34" ry="52" fill="#FFFFFF" opacity="0.22" transform="rotate(-18 222 188)"/>
  <text x="256" y="458" font-family="Inter, sans-serif" font-size="16" font-weight="600" fill="#334155" text-anchor="middle">{safe_label}</text>
  <text x="256" y="482" font-family="monospace" font-size="11" fill="#64748B" text-anchor="middle">STUDIO REFERENCE PREVIEW • READY FOR TRELLIS.2-4B</text>
</svg>"""
    b64_svg = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return {
        "image_data_url": f"data:image/svg+xml;base64,{b64_svg}",
        "provider": "mock-studio",
        "prompt_used": studio_prompt,
    }


async def _run_job(job: JobState, image_path: Optional[Path], remove_bg: bool):
    job.status = "processing"
    output_glb = OUTPUT_DIR / f"{job.id}.glb"

    try:
        if MOCK_MODE:
            stage_steps = [
                ("Removing Background", 20, 0.35),
                ("Generating O-Voxel Geometry", 52, 0.55),
                ("Baking PBR Textures", 80, 0.45),
                ("Optimizing Mesh", 95, 0.35),
            ]
            for stage_name, pct, delay in stage_steps:
                job.stage = stage_name
                job.progress = pct
                await asyncio.sleep(delay)

            metadata = await asyncio.to_thread(
                generate_procedural_mock_glb,
                output_glb,
                job.preset,
                job.target_tris,
                job.seed,
            )
            job.glb_path = output_glb
            job.metadata = metadata.to_dict()
            job.stage = "Completed"
            job.progress = 100
            job.status = "completed"
            job.completed_at = time.time()
            return

        if image_path is None or not image_path.exists():
            raise ValueError("An input image is required for TRELLIS.2-4B generation.")

        def on_stage(stage_name: str, pct: int):
            job.stage = stage_name
            job.progress = pct

        metadata = await asyncio.to_thread(
            runner.generate,
            image_path=image_path,
            output_glb_path=output_glb,
            resolution=job.resolution,
            target_tris=job.target_tris,
            preset=job.preset,
            seed=job.seed,
            remove_bg=remove_bg,
            on_stage=on_stage,
        )
        job.glb_path = output_glb
        job.metadata = metadata.to_dict()
        job.stage = "Completed"
        job.progress = 100
        job.status = "completed"
        job.completed_at = time.time()
    except Exception as exc:
        logger.exception("Job %s failed: %s", job.id, exc)
        job.status = "failed"
        job.stage = "Failed"
        job.error = str(exc)


@app.post("/api/generate")
async def generate_3d(
    image: Optional[UploadFile] = File(default=None),
    resolution: int = Form(default=1024),
    target_tris: int = Form(default=25000),
    preset: PresetType = Form(default="lamina_vet_anatomy"),
    seed: int = Form(default=42),
    remove_bg: bool = Form(default=True),
    prompt: Optional[str] = Form(default=None),
):
    job_id = uuid.uuid4().hex[:12]
    image_path: Optional[Path] = None

    if image is not None:
        ext = Path(image.filename or "input.png").suffix or ".png"
        image_path = OUTPUT_DIR / f"{job_id}_input{ext}"
        content = await image.read()
        image_path.write_bytes(content)

    job = JobState(
        id=job_id,
        resolution=resolution,
        target_tris=target_tris,
        preset=preset,
        seed=seed,
        prompt=prompt,
    )
    JOBS[job_id] = job
    asyncio.create_task(_run_job(job, image_path=image_path, remove_bg=remove_bg))
    return job.to_response()


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_response()


@app.get("/api/jobs/{job_id}/download")
async def download_job(
    job_id: str,
    format: str = Query(default="glb", pattern="^(glb|obj|stl|fbx)$"),
):
    job = JOBS.get(job_id)
    if not job or job.status != "completed" or not job.glb_path or not job.glb_path.exists():
        raise HTTPException(status_code=404, detail="Completed model not found")

    try:
        out_path = await asyncio.to_thread(export_mesh_format, job.glb_path, format)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    media_types = {
        "glb": "model/gltf-binary",
        "obj": "text/plain",
        "stl": "model/stl",
        "fbx": "application/octet-stream",
    }
    return FileResponse(
        path=str(out_path),
        media_type=media_types.get(format, "application/octet-stream"),
        filename=f"lamina_forge_{job.preset}_{job.id}.{format}",
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
