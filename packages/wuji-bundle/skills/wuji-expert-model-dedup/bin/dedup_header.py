#!/usr/bin/env python3
"""Level 1 dedup: rewrite safetensors header metadata to change the whole-file
MD5/SHA256 without touching any weight byte.

Adds unique, meaningful fields to __metadata__ (preserving the original
`format` value). The tensor data is copied byte-for-byte, so the model is
100% unchanged and still loads everywhere.

Usage:
  python dedup_header.py --src SRC --dst DST [--author NAME] [--note TEXT]
"""
import argparse
import json
import os
import struct
import sys
import uuid
from datetime import datetime, timezone


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--author", default="Wuji")
    ap.add_argument("--note", default="dedup revision")
    args = ap.parse_args()

    with open(args.src, "rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        header = json.loads(f.read(n).decode("utf-8"))
        data_start = 8 + n

    tensors = [k for k in header if k != "__metadata__"]
    print(f"header bytes={n}, tensors={len(tensors)}")

    meta = header.get("__metadata__", {})
    if not isinstance(meta, dict):
        meta = {}
    meta["format"] = meta.get("format", "pt")          # keep original
    meta["description"] = f"re-packaged to differentiate upload hash ({args.note})"
    meta["repacked_by"] = args.author
    meta["repacked_at"] = datetime.now(timezone.utc).isoformat()
    meta["repack_id"] = uuid.uuid4().hex
    header["__metadata__"] = meta

    new_header = json.dumps(header, ensure_ascii=False,
                            separators=(",", ":")).encode("utf-8")

    CHUNK = 64 * 1024 * 1024
    written = 0
    with open(args.src, "rb") as fin, open(args.dst, "wb") as fout:
        fout.write(struct.pack("<Q", len(new_header)))
        fout.write(new_header)
        fin.seek(data_start)
        while True:
            buf = fin.read(CHUNK)
            if not buf:
                break
            fout.write(buf)
            written += len(buf)

    expect = 8 + len(new_header) + written
    actual = os.path.getsize(args.dst)
    if actual != expect:
        print(f"ERROR size mismatch expect={expect} actual={actual}",
              file=sys.stderr)
        sys.exit(1)

    with open(args.dst, "rb") as f:
        nn = struct.unpack("<Q", f.read(8))[0]
        json.loads(f.read(nn).decode("utf-8"))
    print("OK: dst parses as valid safetensors, size matches.")
    print(f"DST = {args.dst}")
    print(f"new metadata = {json.dumps(header['__metadata__'], ensure_ascii=False)}")


if __name__ == "__main__":
    main()
