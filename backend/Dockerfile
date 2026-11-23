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

# 3. Copy build patch script, clone TRELLIS.2 + CUDA extensions, compile for sm_89 (L4) & patch SDPA
COPY build_patches.py /tmp/build_patches.py

RUN git clone --recursive https://github.com/microsoft/TRELLIS.2.git /opt/TRELLIS.2 && \
    mkdir -p /tmp/ext && \
    git clone --recursive --shallow-submodules https://github.com/NVlabs/nvdiffrast.git /tmp/ext/nvdiffrast && \
    git clone --recursive --shallow-submodules https://github.com/JeffreyXiang/CuMesh.git /tmp/ext/CuMesh && \
    git clone --recursive --shallow-submodules https://github.com/JeffreyXiang/FlexGEMM.git /tmp/ext/FlexGEMM && \
    python3.11 /tmp/build_patches.py patch-cpp20 /tmp/ext/nvdiffrast /tmp/ext/CuMesh /opt/TRELLIS.2/o-voxel /tmp/ext/FlexGEMM && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation --no-deps /tmp/ext/nvdiffrast && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation --no-deps /tmp/ext/CuMesh && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation --no-deps /opt/TRELLIS.2/o-voxel && \
    python3.11 -m pip install --no-cache-dir --no-build-isolation --no-deps /tmp/ext/FlexGEMM && \
    python3.11 /tmp/build_patches.py patch-sdpa /opt/TRELLIS.2/trellis2/modules/sparse/attention/full_attn.py && \
    rm -rf /tmp/ext /tmp/build_patches.py

ENV PYTHONPATH="/opt/TRELLIS.2:/app"

RUN mkdir -p /app/cache/huggingface /app/cache/torch /app/outputs

COPY main.py trellis_runner.py postprocess.py /app/

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
