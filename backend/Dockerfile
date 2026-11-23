# Lamina Forge — Production Google Cloud Run GPU (NVIDIA L4, Scale-to-Zero) Container
# Pre-compiles nvdiffrast, CuMesh, o-voxel & FlexGEMM for sm_89 (L4) with -std=c++20 + PyTorch SDPA
FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    MOCK_MODE=false \
    TORCH_CUDA_ARCH_LIST="8.9" \
    MAX_JOBS="4" \
    CXXFLAGS="-std=c++20" \
    CUDAFLAGS="-std=c++20" \
    FORCE_CUDA="1" \
    ATTN_BACKEND="sdpa" \
    SPARSE_ATTN_BACKEND="sdpa" \
    OPENCV_IO_ENABLE_OPENEXR="1" \
    PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True" \
    HF_HOME="/app/cache/huggingface" \
    TORCH_HOME="/app/cache/torch" \
    TRELLIS_MODEL_ID="microsoft/TRELLIS.2-4B" \
    TRELLIS_REPO_PATH="/opt/TRELLIS.2"

# 1. System dependencies + Python 3.11
RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends \
    software-properties-common \
    ca-certificates \
    curl \
    wget \
    git \
    build-essential \
    cmake \
    ninja-build \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends \
    python3.11 \
    python3.11-dev \
    python3.11-distutils \
    python3.11-venv \
    && curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11 \
    && ln -sf /usr/bin/python3.11 /usr/local/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/local/bin/python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. PyTorch (CUDA 12.4) & core server / TRELLIS.2 Python dependencies
RUN python3.11 -m pip install --no-cache-dir --upgrade pip setuptools wheel ninja packaging && \
    python3.11 -m pip install --no-cache-dir \
        torch torchvision --index-url https://download.pytorch.org/whl/cu124 && \
    python3.11 -m pip install --no-cache-dir \
        fastapi "uvicorn[standard]" python-multipart \
        trimesh fast-simplification pyfqmr rembg onnxruntime-gpu \
        huggingface_hub transformers timm einops easydict \
        imageio imageio-ffmpeg scipy pillow opencv-python-headless \
        kornia lpips zstandard pymeshfix igraph xatlas plyfile && \
    python3.11 -m pip install --no-cache-dir \
        git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8

# 3. Clone TRELLIS.2 + CUDA extensions and compile all 4 for sm_89 (L4) with -std=c++20
RUN git clone --recursive https://github.com/microsoft/TRELLIS.2.git /opt/TRELLIS.2 && \
    mkdir -p /tmp/ext && \
    git clone --recursive --shallow-submodules https://github.com/NVlabs/nvdiffrast.git /tmp/ext/nvdiffrast && \
    git clone --recursive --shallow-submodules https://github.com/JeffreyXiang/CuMesh.git /tmp/ext/CuMesh && \
    git clone --recursive --shallow-submodules https://github.com/JeffreyXiang/FlexGEMM.git /tmp/ext/FlexGEMM && \
    python3.11 -c '
from pathlib import Path
for repo in [Path("/tmp/ext/nvdiffrast"), Path("/tmp/ext/CuMesh"), Path("/opt/TRELLIS.2/o-voxel"), Path("/tmp/ext/FlexGEMM")]:
    for pat in ("setup.py", "CMakeLists.txt", "*.py", "*.cmake"):
        for fpath in repo.rglob(pat):
            if ".git" in fpath.parts:
                continue
            try:
                text = fpath.read_text(encoding="utf-8")
            except Exception:
                continue
            new_text = text.replace("c++17", "c++20").replace("CXX_STANDARD 17", "CXX_STANDARD 20")
            if fpath.name == "setup.py" and "-std=c++20" not in new_text and "extra_compile_args" in new_text:
                new_text = new_text.replace("\x27-O3\x27", "\x27-O3\x27, \x27-std=c++20\x27").replace("\"-O3\"", "\"-O3\", \"-std=c++20\"")
            if new_text != text:
                fpath.write_text(new_text, encoding="utf-8")
' && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation --no-deps /tmp/ext/nvdiffrast && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation --no-deps /tmp/ext/CuMesh && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation --no-deps /opt/TRELLIS.2/o-voxel && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation --no-deps /tmp/ext/FlexGEMM && \
    rm -rf /tmp/ext

# 4. Append pure-PyTorch SDPA sparse attention override to TRELLIS.2 full_attn.py
RUN python3.11 -c '
from pathlib import Path
p = Path("/opt/TRELLIS.2/trellis2/modules/sparse/attention/full_attn.py")
override = """

# --- Lamina Forge: PyTorch SDPA fallback for sparse attention ---
_orig_sparse_sdpa = sparse_scaled_dot_product_attention

def sparse_scaled_dot_product_attention(*args, **kwargs):
    if config.ATTN != "sdpa":
        return _orig_sparse_sdpa(*args, **kwargs)
    import torch
    import torch.nn.functional as F

    if len(args) == 1 and "kv" not in kwargs and "k" not in kwargs:
        qkv = args[0]
        out = torch.cat([
            F.scaled_dot_product_attention(
                qkv.feats[qkv.layout[b]][:, 0].transpose(0, 1).unsqueeze(0),
                qkv.feats[qkv.layout[b]][:, 1].transpose(0, 1).unsqueeze(0),
                qkv.feats[qkv.layout[b]][:, 2].transpose(0, 1).unsqueeze(0),
            ).squeeze(0).transpose(0, 1)
            for b in range(len(qkv.layout))
        ], dim=0)
        return qkv.replace(out)

    if len(args) == 2 or "kv" in kwargs:
        q = args[0]
        kv = args[1] if len(args) >= 2 else kwargs["kv"]
        out_list = []
        for b in range(len(q.layout)):
            qb = q.feats[q.layout[b]].transpose(0, 1).unsqueeze(0)
            if hasattr(kv, "feats"):
                kb = kv.feats[kv.layout[b]][:, 0].transpose(0, 1).unsqueeze(0)
                vb = kv.feats[kv.layout[b]][:, 1].transpose(0, 1).unsqueeze(0)
            else:
                kb = kv[b, :, 0].transpose(0, 1).unsqueeze(0)
                vb = kv[b, :, 1].transpose(0, 1).unsqueeze(0)
            ob = F.scaled_dot_product_attention(qb, kb, vb).squeeze(0).transpose(0, 1)
            out_list.append(ob)
        return q.replace(torch.cat(out_list, dim=0))

    q = args[0]
    k = args[1] if len(args) >= 2 else kwargs["k"]
    v = args[2] if len(args) >= 3 else kwargs["v"]
    out_list = []
    for b in range(len(q.layout)):
        qb = q.feats[q.layout[b]].transpose(0, 1).unsqueeze(0)
        kb = (k.feats[k.layout[b]] if hasattr(k, "feats") else k[b]).transpose(0, 1).unsqueeze(0)
        vb = (v.feats[v.layout[b]] if hasattr(v, "feats") else v[b]).transpose(0, 1).unsqueeze(0)
        ob = F.scaled_dot_product_attention(qb, kb, vb).squeeze(0).transpose(0, 1)
        out_list.append(ob)
    return q.replace(torch.cat(out_list, dim=0))
"""
p.write_text(p.read_text(encoding="utf-8") + override, encoding="utf-8")
'

ENV PYTHONPATH="/opt/TRELLIS.2:/app"

RUN mkdir -p /app/cache/huggingface /app/cache/torch /app/outputs

COPY main.py trellis_runner.py postprocess.py /app/

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
