"""
Notebook setup script — run once to install dependencies into the uv venv.

Usage (from the datasaur-project root or notebooks/ dir):
    uv run python notebooks/setup.py

This replaces the old `!pip install ...` cells in the notebook.
After running this, open the notebook and Cell 1 can be skipped /
replaced with the dotenv-loading snippet below.
"""

import subprocess
import sys
from pathlib import Path

# ── Install dependencies via uv ───────────────────────────────────────────────
PACKAGES = [
    "openai",
    "geopy",
    "pandas",
    "numpy",
    "yandex_geocoder",
    "langchain_openai",
    "python-dotenv",
    "tiktoken",
]

print("[setup] Installing packages into uv venv …")
subprocess.check_call(
    ["uv", "pip", "install", "--quiet"] + PACKAGES,
)
print(f"[setup] Done. {len(PACKAGES)} packages ready.")

# ── Verify .env exists ───────────────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    print(f"[setup] .env found at {env_path}  ✓")
else:
    print(f"[setup] ⚠️  No .env found at {env_path}. Create it with:")
    print("        OPENAI_API_KEY=sk-...")
    print("        YANDEX_API_KEY=...")
