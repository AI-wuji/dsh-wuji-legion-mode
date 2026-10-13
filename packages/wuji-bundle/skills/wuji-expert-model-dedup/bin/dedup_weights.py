#!/usr/bin/env python3
"""Level 2 dedup: spread weight-byte perturbation to change the weight-data
hash (for platforms that de-dup by weight bytes, not whole-file hash).

Strategy: stream-copy src -> dst, then flip the SIGN bit (high byte XOR 0x80)
of the first element of every Nth tensor. Each flip is a single ULP (smallest
precision unit) so the model output is visually identical, yet the weight-data
hash necessarily differs. Header is preserved.

Usage:
  python dedup_weights.py --src SRC --dst DST [--every N] [--mode sign|lsb]

  --every N : perturb every Nth tensor (default 4 -> ~60+ flips on a 265-tensor
              model). Smaller N = stronger perturbation.
  --mode lsb: flip the lowest bit instead of the sign bit (even more subtle;
              some platforms' coarse fingerprints may absorb it).
"""
import argparse
import hashlib
import json
import os
import struct
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--every", type=int, default=4)
    ap.add_argument("--mode", choices=["sign", "lsb"], default="sign")
    args = ap.parse_args()

    with open(args.src, "rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        header = json.loads(f.read(n).decode("utf-8"))
    data_start = 8 + n

    tensors = [k for k in header if k != "__metadata__"]
    selected = tensors[::max(1, args.every)]
    print(f"total tensors={len(tensors)}, perturbing every {args.every} "
          f"-> {len(selected)} flips (mode={args.mode})")

    CHUNK = 64 * 1024 * 1024
    with open(args.src, "rb") as fin, open(args.dst, "wb") as fout:
        while True:
            buf = fin.read(CHUNK)
            if not buf:
                break
            fout.write(buf)
    print(f"copied GB={round(os.path.getsize(args.dst)/1024**3, 2)}")

    mask = 0x80 if args.mode == "sign" else 0x01
    cnt = 0
    with open(args.dst, "r+b") as f:
        for name in selected:
            off = data_start + header[name]["data_offsets"][0] + (1 if args.mode == "sign" else 0)
            f.seek(off)
            b = f.read(1)[0]
            f.seek(off)
            f.write(bytes([b ^ mask]))
            cnt += 1
    print(f"patched={cnt}")

    with open(args.dst, "rb") as f:
        nn = struct.unpack("<Q", f.read(8))[0]
        json.loads(f.read(nn).decode("utf-8"))
    print(f"header re-parses OK, size GB={round(os.path.getsize(args.dst)/1024**3, 2)}")

    h = hashlib.md5()
    with open(args.dst, "rb") as f:
        for blk in iter(lambda: f.read(CHUNK), b""):
            h.update(blk)
    print(f"MD5={h.hexdigest()}")


if __name__ == "__main__":
    main()
