# Lamina Forge — Google Cloud Run L4 GPU (Scale-to-Zero) Container
# Deploy with: --gpu 1 --gpu-type nvidia-l4 --min-instances 0 --port 8080
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    HF_HOME=/app/cache/huggingface \
    TORCH_HOME=/app/cache/torch \
    OPENCV_IO_ENABLE_OPENEXR=1 \
    PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
    TRELLIS_MODEL_ID=microsoft/TRELLIS.2-4B

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3-pip \
    python3-dev \
    git \
    wget \
    curl \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch CUDA 12.4 + core server dependencies
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir \
    torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu124

COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt && \
    pip3 install --no-cache-dir rembg onnxruntime-gpu huggingface_hub transformers

# Clone & install Microsoft TRELLIS.2-4B runtime
RUN git clone --depth 1 https://github.com/microsoft/TRELLIS.2.git /opt/TRELLIS.2 || true
ENV PYTHONPATH="/opt/TRELLIS.2:/app:${PYTHONPATH}"

# Create persistent cache & output dirs (mount GCS bucket or Cloud Run volume to /app/cache for warm starts)
RUN mkdir -p /app/cache/huggingface /app/cache/torch /app/outputs

COPY main.py trellis_runner.py postprocess.py /app/

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
