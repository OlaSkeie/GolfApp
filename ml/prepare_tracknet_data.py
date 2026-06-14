#!/usr/bin/env python3
"""
Convert YOLO golf ball dataset → TrackNetV3 training format.

TrackNetV3 expects:
  data/{split}/match{N}/
    frame/{rally_id}/00001.jpg, 00002.jpg, ...
    csv/{rally_id}_ball.csv     (Frame, Visibility, X, Y)
    median.npz                  (match-level median, required for bg_mode=concat)

YOLO filenames: {VideoName}_{RallyID}_{FrameNum}_jpg.rf.{hash}.jpg
                OR {SeqNum}_{FrameNum}_jpg.rf.{hash}.jpg
YOLO labels:    class cx_norm cy_norm w_norm h_norm  (416×416 images)

Usage:
    cd ml/
    python prepare_tracknet_data.py
"""

import os
import re
import shutil
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
import pandas as pd

YOLO_BASE = Path(__file__).parent / 'golfBall.yolov8'
OUT_BASE  = Path(__file__).parent / 'TrackNetV3' / 'data'
IMG_W = IMG_H = 416  # original YOLO image size

SPLITS = [
    ('train', 'train'),
    ('valid', 'val'),
    # test split ikke nødvendig for fine-tuning
]

SEQ_LEN = 8  # TrackNetV3 sequence length — pad short rallies to this minimum


def parse_stem(stem: str):
    """
    Parse filename stem (without extension or rf-hash suffix) into
    (match_key, rally_key, frame_num).

    Handles:
    - Image0210_10633_00001  → match=Image0210, rally=10633, frame=1
    - 00001_00002            → match=00001, rally=1, frame=2
    - Golf17_frame001        → match=Golf17, rally=1, frame=1
    """
    parts = stem.split('_')
    try:
        frame_num = int(parts[-1])
    except ValueError:
        return None

    if len(parts) >= 3:
        try:
            int(parts[-2])           # rally id is numeric
            rally_key  = parts[-2]
            match_key  = '_'.join(parts[:-2])
        except ValueError:
            rally_key  = '1'
            match_key  = '_'.join(parts[:-1])
    else:
        rally_key = '1'
        match_key = parts[0]

    return match_key, rally_key, frame_num


def gen_median(paths: list, size: tuple = (416, 416)) -> np.ndarray:
    """Compute median image (H×W×3 float32 RGB) from a list of image paths."""
    imgs = []
    for p in paths:
        img = cv2.imread(str(p))
        if img is not None:
            img = cv2.resize(img, size)
            imgs.append(img[..., ::-1].astype(np.float32))  # BGR→RGB
    if not imgs:
        return np.zeros((size[1], size[0], 3), dtype=np.float32)
    return np.median(np.stack(imgs, axis=0), axis=0)


def convert_split(yolo_split: str, tn_split: str):
    img_dir   = YOLO_BASE / yolo_split / 'images'
    label_dir = YOLO_BASE / yolo_split / 'labels'
    if not img_dir.exists():
        print(f'  {yolo_split}: not found, skipping')
        return

    # ── Group files by (match, rally) ────────────────────────────────────────
    rallies: dict[tuple, list] = defaultdict(list)
    for img_path in img_dir.iterdir():
        if img_path.suffix.lower() not in ('.jpg', '.jpeg', '.png'):
            continue
        stem = re.sub(r'_(jpg|png)\.rf\.[^.]+$', '', img_path.stem)
        parsed = parse_stem(stem)
        if parsed is None:
            continue
        match_key, rally_key, frame_num = parsed
        label_path = label_dir / (img_path.stem + '.txt')
        rallies[(match_key, rally_key)].append((frame_num, img_path, label_path))

    # ── Assign sequential match indices ──────────────────────────────────────
    match_keys = sorted({mk for mk, _ in rallies})
    match_idx  = {mk: i + 1 for i, mk in enumerate(match_keys)}

    n_rallies = 0
    for (match_key, rally_key), frames in sorted(rallies.items()):
        frames.sort(key=lambda x: x[0])
        midx = match_idx[match_key]

        out_frame_dir = OUT_BASE / tn_split / f'match{midx}' / 'frame' / rally_key
        out_csv_dir   = OUT_BASE / tn_split / f'match{midx}' / 'csv'
        out_frame_dir.mkdir(parents=True, exist_ok=True)
        out_csv_dir.mkdir(parents=True, exist_ok=True)

        # Pad short rallies so every rally has at least SEQ_LEN frames
        while len(frames) < SEQ_LEN:
            frames.append(frames[-1])

        rows = []
        for new_fn, (_, img_path, label_path) in enumerate(frames, start=0):
            # Symlink as .png — PIL/cv2 reads by header, not extension
            dst = out_frame_dir / f'{new_fn}.png'
            if not dst.exists():
                dst.symlink_to(img_path.resolve())

            x, y, vis = 0, 0, 0
            if label_path.exists():
                lines = label_path.read_text().strip().splitlines()
                if lines:
                    parts = lines[0].split()
                    cx_n, cy_n = float(parts[1]), float(parts[2])
                    x   = round(cx_n * IMG_W)
                    y   = round(cy_n * IMG_H)
                    vis = 1

            rows.append({'Frame': new_fn, 'Visibility': vis, 'X': x, 'Y': y})  # 0-indexed

        pd.DataFrame(rows).to_csv(out_csv_dir / f'{rally_key}_ball.csv', index=False)
        n_rallies += 1

    # ── Generate match-level median.npz only (skip per-rally to save disk) ──
    for match_key in match_keys:
        midx           = match_idx[match_key]
        match_dir      = OUT_BASE / tn_split / f'match{midx}'
        match_med_path = match_dir / 'median.npz'
        if not match_med_path.exists():
            all_imgs = list((match_dir / 'frame').rglob('*.png'))[:50]
            match_med = gen_median(all_imgs)
            np.savez(match_med_path, median=match_med)

    print(f'  {tn_split}: {len(match_keys)} matches, {n_rallies} rallies')


if __name__ == '__main__':
    OUT_BASE.mkdir(parents=True, exist_ok=True)
    print('Konverterer YOLO → TrackNetV3 format...')
    for yolo_split, tn_split in SPLITS:
        convert_split(yolo_split, tn_split)
    print('Ferdig. Data i:', OUT_BASE)
