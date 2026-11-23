"""
Lamina Forge — Microsoft TRELLIS.2-4B Inference Runner
Handles model loading (microsoft/TRELLIS.2-4B), SDPA attention fallback when flash_attn
is unavailable, DINOv3 transformers v4/v5 compatibility, BiRefNet/RMBG-2.0 config patching,
safe background removal fallbacks, O-Voxel geometry generation, PBR texture baking,
and GPU memory cleanup.
"""

from __future__ import annotations

import gc
import importlib.util
import json
import logging
import os
import re
import sys
import types
from pathlib import Path
from typing import Callable, Optional

from postprocess import MeshMetadata, PresetType, postprocess_mesh

logger = logging.getLogger("lamina_forge.trellis")

MODEL_ID = os.environ.get("TRELLIS_MODEL_ID", "microsoft/TRELLIS.2-4B")
TRELLIS_REPO_PATH = os.environ.get("TRELLIS_REPO_PATH", "/content/TRELLIS.2")
STAGE_CALLBACK = Optional[Callable[[str, int], None]]


def _ensure_trellis_on_sys_path() -> None:
    """Ensure the TRELLIS.2 repository directory is present on sys.path."""
    candidates = [
        TRELLIS_REPO_PATH,
        "/content/TRELLIS.2",
        "/opt/TRELLIS.2",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        repo_dir = Path(candidate)
        if repo_dir.exists():
            repo_str = str(repo_dir.resolve())
            if repo_str not in sys.path:
                sys.path.insert(0, repo_str)


def _configure_attention_backend() -> str:
    """
    If flash_attn is not installed (common on Colab Python 3.13 + CUDA 13.0),
    force PyTorch native SDPA across env vars and TRELLIS.2 attention configs.
    """
    has_flash_attn = importlib.util.find_spec("flash_attn") is not None
    if has_flash_attn:
        return os.environ.get("ATTN_BACKEND", "flash_attn")

    os.environ["ATTN_BACKEND"] = "sdpa"
    os.environ["SPARSE_ATTN_BACKEND"] = "sdpa"

    for mod_name in (
        "trellis2.modules.attention.config",
        "trellis2.modules.sparse.config",
        "trellis2.modules.sparse.attention.config",
    ):
        try:
            mod = __import__(mod_name, fromlist=["*"])
            for attr in ("BACKEND", "ATTN", "ATTN_BACKEND", "SPARSE_ATTN_BACKEND"):
                if hasattr(mod, attr) and getattr(mod, attr) in ("flash_attn", "flash_attn_3"):
                    setattr(mod, attr, "sdpa")
        except Exception:
            pass

    return "sdpa"


def patch_birefnet_cache_configs() -> None:
    """
    Ensure cached RMBG-2.0 / BiRefNet config.json and *config*.py files define
    model_type = 'birefnet' so newer transformers versions never fail with:
      AttributeError: 'Config' object has no attribute 'model_type'
    """
    hf_home = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"))
    hub_dir = Path(os.environ.get("HUGGINGFACE_HUB_CACHE", hf_home / "hub"))
    modules_dir = hf_home / "modules" / "transformers_modules"

    target_dirs = [
        hub_dir / "models--briaai--RMBG-2.0",
        hub_dir / "models--ZhengPeng7--BiRefNet",
    ]

    for base_dir in target_dirs:
        if not base_dir.exists():
            continue
        for cfg_path in base_dir.rglob("config.json"):
            try:
                data = json.loads(cfg_path.read_text(encoding="utf-8"))
                if data.get("model_type") != "birefnet":
                    data["model_type"] = "birefnet"
                    cfg_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
                    logger.info("Patched model_type='birefnet' in %s", cfg_path)
            except Exception as exc:
                logger.debug("Skipping config.json patch for %s: %s", cfg_path, exc)

        for py_path in base_dir.rglob("*config*.py"):
            _patch_birefnet_config_py(py_path)

    if modules_dir.exists():
        for py_path in modules_dir.rglob("*config*.py"):
            if "birefnet" in str(py_path).lower() or "rmbg" in str(py_path).lower():
                _patch_birefnet_config_py(py_path)


def _patch_birefnet_config_py(py_path: Path) -> None:
    """Inject class attribute `model_type = "birefnet"` into BiRefNetConfig if missing."""
    try:
        src = py_path.read_text(encoding="utf-8")
        if "class BiRefNetConfig" not in src or 'model_type = "birefnet"' in src or "model_type = 'birefnet'" in src:
            return
        patched = re.sub(
            r"(class\s+BiRefNetConfig\([^)]*\):\s*\n)",
            r'\1    model_type = "birefnet"\n',
            src,
            count=1,
        )
        if patched != src:
            py_path.write_text(patched, encoding="utf-8")
            logger.info("Patched BiRefNetConfig.model_type in %s", py_path)
    except Exception as exc:
        logger.debug("Skipping python config patch for %s: %s", py_path, exc)


def _install_autoconfig_model_type_guard() -> None:
    """
    Runtime guard on transformers.AutoConfig.from_pretrained so any BiRefNet/RMBG
    config loaded via trust_remote_code always exposes `model_type = 'birefnet'`,
    even when `return_unused_kwargs=True` returns a `(config, kwargs)` tuple.
    """
    try:
        from transformers import AutoConfig

        if getattr(AutoConfig, "_lamina_birefnet_patched", False):
            return

        orig_from_pretrained = AutoConfig.from_pretrained.__func__

        @classmethod
        def _guarded_from_pretrained(cls, pretrained_model_name_or_path, *args, **kwargs):
            res = orig_from_pretrained(cls, pretrained_model_name_or_path, *args, **kwargs)
            cfg = res[0] if isinstance(res, tuple) else res
            if not getattr(cfg, "model_type", None):
                name_lower = str(pretrained_model_name_or_path).lower()
                if "birefnet" in name_lower or "rmbg" in name_lower or "birefnet" in type(cfg).__name__.lower():
                    try:
                        type(cfg).model_type = "birefnet"
                    except Exception:
                        pass
                    setattr(cfg, "model_type", "birefnet")
            return res

        AutoConfig.from_pretrained = _guarded_from_pretrained
        AutoConfig._lamina_birefnet_patched = True
    except Exception as exc:
        logger.debug("Could not install AutoConfig guard: %s", exc)


def _patch_dinov3_feature_extractor(pipeline) -> None:
    """
    Patch TRELLIS.2's DinoV3FeatureExtractor.extract_features so it works across all
    transformers versions (where DINOv3ViTModel may store blocks in .layer, .layers,
    .encoder.layer, .encoder.layers, or .blocks) by using the official HuggingFace
    model(pixel_values=..., output_hidden_states=True) forward pass first.
    """
    cond_model = getattr(pipeline, "image_cond_model", None)
    if cond_model is None or not hasattr(cond_model, "model"):
        return

    def _compat_extract_features(self_ext, image):
        import torch.nn.functional as F

        model = self_ext.model
        try:
            outputs = model(pixel_values=image, output_hidden_states=True)
            if getattr(outputs, "hidden_states", None):
                hidden_states = outputs.hidden_states[-1]
            elif hasattr(outputs, "last_hidden_state"):
                hidden_states = outputs.last_hidden_state
            else:
                hidden_states = outputs[0]
            return F.layer_norm(hidden_states, hidden_states.shape[-1:])
        except Exception as fwd_exc:
            layers = None
            for attr_path in (
                ("layer",),
                ("layers",),
                ("encoder", "layer"),
                ("encoder", "layers"),
                ("blocks",),
            ):
                obj = model
                for attr in attr_path:
                    obj = getattr(obj, attr, None)
                    if obj is None:
                        break
                if obj is not None:
                    layers = obj
                    break

            if layers is None:
                children = [name for name, _ in model.named_children()]
                raise AttributeError(
                    f"DINOv3 forward failed ({fwd_exc}) and could not locate transformer layers on "
                    f"{type(model).__name__} (children={children})."
                ) from fwd_exc

            hidden_states = model.embeddings(image, bool_masked_pos=None)
            position_embeddings = model.rope_embeddings(image)
            for layer_module in layers:
                hidden_states = layer_module(hidden_states, position_embeddings=position_embeddings)
            return F.layer_norm(hidden_states, hidden_states.shape[-1:])

    cond_model.extract_features = types.MethodType(_compat_extract_features, cond_model)
    logger.info("Patched %s.extract_features for transformers v4/v5 DINOv3 compatibility.", type(cond_model).__name__)


_ensure_trellis_on_sys_path()
_configure_attention_backend()


def _has_meaningful_alpha(pil_img) -> bool:
    """Return True if an RGBA image already contains transparent background pixels."""
    if pil_img.mode != "RGBA":
        return False
    alpha = pil_img.getchannel("A")
    lo, hi = alpha.getextrema()
    return lo < 240 and hi > 20


def _extract_white_background_alpha(pil_img, threshold: int = 242):
    """
    Clean fallback alpha extraction when an image sits on a solid white/near-white
    studio background and neural matting models are unavailable.
    """
    import numpy as np
    from PIL import Image

    rgba = pil_img.convert("RGBA")
    arr = np.array(rgba, dtype=np.uint8)
    rgb = arr[:, :, :3]

    border = np.concatenate(
        [rgb[0, :, :], rgb[-1, :, :], rgb[:, 0, :], rgb[:, -1, :]],
        axis=0,
    )
    if float(np.median(border)) < threshold:
        return rgba

    dist = np.max(255 - rgb, axis=-1).astype(np.float32)
    alpha = np.clip((dist - 10.0) / 24.0, 0.0, 1.0)
    arr[:, :, 3] = (alpha * 255.0).astype(np.uint8)
    return Image.fromarray(arr, mode="RGBA")


def remove_background_safe(pil_img, remove_bg: bool = True):
    """
    Safe multi-tier background removal that never crashes inference:
      1. If remove_bg is False -> return RGBA directly
      2. If image already has a clean alpha channel -> preserve it
      3. Try rembg (u2net)
      4. Fallback to studio white-background alpha extraction / original RGBA
    """
    rgba = pil_img.convert("RGBA")
    if not remove_bg:
        return rgba

    if _has_meaningful_alpha(rgba):
        return rgba

    try:
        from rembg import remove

        return remove(rgba).convert("RGBA")
    except Exception as exc:
        logger.warning("rembg unavailable or failed (%s); trying white-background alpha fallback.", exc)

    try:
        return _extract_white_background_alpha(rgba)
    except Exception as exc:
        logger.warning("White-background fallback failed (%s); passing RGBA image as-is.", exc)
        return rgba


class _SafeRembgFallback:
    """Drop-in callable wrapper supporting .to()/.cuda()/.cpu() so pipeline.cuda() succeeds."""

    def __init__(self, orig_rembg=None):
        self._orig_rembg = orig_rembg

    def __call__(self, image):
        if _has_meaningful_alpha(image):
            return image
        if self._orig_rembg is not None:
            try:
                return self._orig_rembg(image)
            except Exception as rembg_exc:
                logger.warning("Pipeline rembg_model failed (%s); using safe fallback.", rembg_exc)
        return remove_background_safe(image, remove_bg=True)

    def to(self, *args, **kwargs):
        if self._orig_rembg is not None and hasattr(self._orig_rembg, "to"):
            self._orig_rembg.to(*args, **kwargs)
        return self

    def cuda(self, *args, **kwargs):
        if self._orig_rembg is not None and hasattr(self._orig_rembg, "cuda"):
            self._orig_rembg.cuda(*args, **kwargs)
        return self

    def cpu(self, *args, **kwargs):
        if self._orig_rembg is not None and hasattr(self._orig_rembg, "cpu"):
            self._orig_rembg.cpu(*args, **kwargs)
        return self


class TrellisRunner:
    """Lazy-loaded wrapper around Microsoft TRELLIS.2-4B for L4 / A100 GPUs."""

    def __init__(self, model_id: str = MODEL_ID):
        self.model_id = model_id
        self._pipeline = None
        self._device = "cpu"
        self._gpu_name = "CPU"

    def detect_hardware(self) -> tuple[str, str]:
        try:
            import torch

            if torch.cuda.is_available():
                self._device = "cuda"
                self._gpu_name = torch.cuda.get_device_name(0)
            else:
                self._device = "cpu"
                self._gpu_name = "CPU (No CUDA)"
        except ImportError:
            self._device = "cpu"
            self._gpu_name = "CPU (PyTorch not installed)"
        return self._device, self._gpu_name

    def load(self) -> None:
        if self._pipeline is not None:
            return

        _ensure_trellis_on_sys_path()
        backend = _configure_attention_backend()
        patch_birefnet_cache_configs()
        _install_autoconfig_model_type_guard()

        self.detect_hardware()
        os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")
        os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

        logger.info("Loading %s on %s (%s, attn=%s)...", self.model_id, self._device, self._gpu_name, backend)
        try:
            from trellis2.pipelines import Trellis2ImageTo3DPipeline

            _configure_attention_backend()
            try:
                self._pipeline = Trellis2ImageTo3DPipeline.from_pretrained(self.model_id)
            except Exception as exc:
                if "model_type" in str(exc) or "BiRefNet" in str(exc) or "RMBG" in str(exc):
                    logger.warning("Retrying TRELLIS.2 load after patching BiRefNet config (%s)...", exc)
                    patch_birefnet_cache_configs()
                    _install_autoconfig_model_type_guard()
                    self._pipeline = Trellis2ImageTo3DPipeline.from_pretrained(self.model_id)
                else:
                    raise
        except ImportError as exc_v2:
            try:
                from trellis.pipelines import TrellisImageTo3DPipeline

                self._pipeline = TrellisImageTo3DPipeline.from_pretrained(self.model_id)
            except ImportError as exc_v1:
                raise ImportError(
                    f"Could not import 'trellis2' or 'trellis' (TRELLIS_REPO_PATH={TRELLIS_REPO_PATH}). "
                    f"Ensure https://github.com/microsoft/TRELLIS.2.git is cloned with --recursive and setup completed. "
                    f"Errors: trellis2={exc_v2}; trellis={exc_v1}"
                ) from exc_v2

        # Patch DINOv3 feature extractor for transformers v4/v5 compatibility
        _patch_dinov3_feature_extractor(self._pipeline)

        # Cast BiRefNet / rembg_model to float32 before wrapping so GPU inference never fails
        # with "Input type (float) and bias type (c10::Half) should be the same"
        if hasattr(self._pipeline, "rembg_model"):
            orig_rembg = self._pipeline.rembg_model
            if orig_rembg is not None:
                try:
                    if hasattr(orig_rembg, "float"):
                        orig_rembg.float()
                    elif hasattr(orig_rembg, "model") and hasattr(orig_rembg.model, "float"):
                        orig_rembg.model.float()
                except Exception as cast_exc:
                    logger.debug("Could not cast rembg_model to float32: %s", cast_exc)
            self._pipeline._lamina_orig_rembg = orig_rembg
            self._pipeline.rembg_model = _SafeRembgFallback(orig_rembg)

        if self._device == "cuda":
            self._pipeline.cuda()
            rembg_inner = getattr(self._pipeline, "_lamina_orig_rembg", None)
            if rembg_inner is not None:
                try:
                    if hasattr(rembg_inner, "float"):
                        rembg_inner.float()
                    elif hasattr(rembg_inner, "model") and hasattr(rembg_inner.model, "float"):
                        rembg_inner.model.float()
                except Exception:
                    pass

        logger.info("TRELLIS.2-4B pipeline ready.")

    def _remove_background(self, image_path: Path, remove_bg: bool):
        from PIL import Image

        img = Image.open(image_path).convert("RGBA")
        return remove_background_safe(img, remove_bg=remove_bg)

    def generate(
        self,
        image_path: Path,
        output_glb_path: Path,
        resolution: int = 1024,
        target_tris: int = 25000,
        preset: PresetType = "lamina_vet_anatomy",
        seed: int = 42,
        remove_bg: bool = True,
        on_stage: STAGE_CALLBACK = None,
    ) -> MeshMetadata:
        """Run full TRELLIS.2-4B inference + post-processing."""
        import torch

        def report(stage: str, progress: int):
            if on_stage:
                on_stage(stage, progress)

        self.load()

        # Stage 1: Background removal
        report("Removing Background", 15)
        pil_image = self._remove_background(image_path, remove_bg=remove_bg)

        # Stage 2: O-Voxel geometry generation
        report("Generating O-Voxel Geometry", 42)
        pipeline_type_map = {
            512: "512",
            1024: "1024_cascade",
            1536: "1536_cascade",
        }
        pipeline_type = pipeline_type_map.get(resolution, "1024_cascade")
        texture_size = 1024 if resolution <= 1024 else 2048

        torch.manual_seed(seed)
        raw_glb_path = output_glb_path.with_name(f"{output_glb_path.stem}_raw.glb")

        outputs = None
        mesh_out = None
        glb = None
        try:
            outputs = self._pipeline.run(
                pil_image,
                seed=seed,
                pipeline_type=pipeline_type,
            )
            mesh_out = outputs[0]

            # Stage 3: Baking PBR textures
            report("Baking PBR Textures", 74)
            try:
                import o_voxel

                attr_layout = getattr(mesh_out, "layout", None) or getattr(
                    self._pipeline, "pbr_attr_layout", None
                )
                glb = o_voxel.postprocess.to_glb(
                    vertices=mesh_out.vertices,
                    faces=mesh_out.faces,
                    attr_volume=mesh_out.attrs,
                    coords=mesh_out.coords,
                    attr_layout=attr_layout,
                    voxel_size=mesh_out.voxel_size,
                    aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
                    decimation_target=min(max(target_tris * 3, 60000), 180000),
                    texture_size=texture_size,
                    remesh=True,
                )
                glb.export(str(raw_glb_path))
            except ImportError:
                from trellis.utils import postprocessing_utils

                glb = postprocessing_utils.to_glb(
                    outputs["gaussian"][0],
                    outputs["mesh"][0],
                    simplify=0.95,
                    texture_size=texture_size,
                )
                glb.export(str(raw_glb_path))
        finally:
            del outputs, mesh_out, glb
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        # Stage 4: Mesh cleanup, pivot alignment & final GLB export
        report("Optimizing Mesh", 90)
        metadata = postprocess_mesh(
            input_glb_path=raw_glb_path,
            output_glb_path=output_glb_path,
            preset=preset,
            target_tris=target_tris,
            use_draco=False,
        )
        raw_glb_path.unlink(missing_ok=True)
        report("Completed", 100)
        return metadata