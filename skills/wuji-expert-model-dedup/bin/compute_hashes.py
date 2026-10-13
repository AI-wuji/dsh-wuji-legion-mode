#!/usr/bin/env python3
"""Compute MD5 / SHA256 of a model file.

Usage:
  python compute_hashes.py --file PATH [--data-segment]

For safetensors, --data-segment hashes only the tensor byte region
(8-byte header length + JSON header .. EOF), which is the hash that
matters when a platform de-duplicates by *weight data* rather than the
whole file. Useful to diagnose why a header-only edit still gets flagged.
"""
import argparse
import hashlib
import json
import struct
import sys


def _stream(path, h, chunk=64 * 1024 * 1024):
    with open(path, "rb") as f:
        for blk in iter(lambda: f.read(chunk), b""):
            h.update(blk)


def _data_segment_span(path):
    """Return (data_start, data_end) for a safetensors file, or None."""
    try:
        with open(path, "rb") as f:
            n = struct.unpack("<Q", f.read(8))[0]
            json.loads(f.read(n).decode("utf-8"))  # validate header
        return (8 + n, None)
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--data-segment", action="store_true",
                    help="safetensors: hash only the tensor byte region")
    args = ap.parse_args()

    md5 = hashlib.md5()
    sha = hashlib.sha256()

    if args.data_segment:
        span = _data_segment_span(args.file)
        if span is None:
            print("ERROR: --data-segment only supports valid safetensors files",
                  file=sys.stderr)
            sys.exit(1)
        start, _ = span
        with open(args.file, "rb") as f:
            f.seek(start)
            for blk in iter(lambda: f.read(64 * 1024 * 1024), b""):
                md5.update(blk)
                sha.update(blk)
        print(f"[data-segment, from byte {start}]")
    else:
        _stream(args.file, md5)
        _stream(args.file, sha)

    print(f"MD5 : {md5.hexdigest()}")
    print(f"SHA256: {sha.hexdigest()}")


if __name__ == "__main__":
    main()
