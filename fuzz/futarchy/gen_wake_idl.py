"""Create a Wake-only Anchor 0.29 IDL with correct ix discriminators."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re


WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
SOURCE_IDL = WORKSPACE_ROOT / "target" / "idl" / "futarchy.json"
OUTPUT_ROOT = WORKSPACE_ROOT / "target" / "wake-idl"
PROGRAM_ADDRESS = "FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq"


def _snake_case(name: str) -> str:
    """Convert a legacy Anchor IDL camelCase instruction name to Rust form."""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _instruction_discriminator(name: str) -> list[int]:
    """Compute Anchor's first-eight-byte global instruction discriminator."""
    rust_name = _snake_case(name)
    digest = hashlib.sha256(f"global:{rust_name}".encode()).digest()[:8]
    return list(digest)


def generate() -> None:
    """Copy the build IDL and add only Wake-required compatibility fields."""
    if not SOURCE_IDL.exists():
        raise FileNotFoundError(f"missing build IDL: {SOURCE_IDL}")

    idl = json.loads(SOURCE_IDL.read_text())
    for instruction in idl.get("instructions", []):
        instruction["discriminator"] = _instruction_discriminator(
            instruction["name"]
        )

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    destination = OUTPUT_ROOT / f"{PROGRAM_ADDRESS}.json"
    destination.write_text(json.dumps(idl, indent=2) + "\n")


if __name__ == "__main__":
    generate()
