"""Build-time helper for Lamina Forge Docker image (C++20 patching + PyTorch SDPA override)."""

from __future__ import annotations

import sys
from pathlib import Path

SDPA_OVERRIDE = """

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


def patch_cpp20(repos: list[Path]) -> None:
    for repo in repos:
        patched = 0
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
                    new_text = new_text.replace("'-O3'", "'-O3', '-std=c++20'").replace('"-O3"', '"-O3", "-std=c++20"')
                if new_text != text:
                    fpath.write_text(new_text, encoding="utf-8")
                    patched += 1
        print(f"Patched C++20 flags in {patched} file(s) under {repo}")


def patch_sdpa(full_attn_path: Path) -> None:
    text = full_attn_path.read_text(encoding="utf-8")
    if "_orig_sparse_sdpa" not in text:
        full_attn_path.write_text(text + SDPA_OVERRIDE, encoding="utf-8")
        print(f"Appended PyTorch SDPA sparse attention override to {full_attn_path}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "patch-cpp20":
        patch_cpp20([Path(p) for p in sys.argv[2:]])
    elif cmd == "patch-sdpa":
        patch_sdpa(Path(sys.argv[2]))
    else:
        raise SystemExit("Usage: build_patches.py [patch-cpp20 <dirs...> | patch-sdpa <full_attn.py>]")
