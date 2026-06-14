"""Pose-baserte svingmålinger.

Kjører MediaPipe Pose på hele svingen, finner nøkkelframes (address/top/impact),
og regner ut vinkler + forskyvninger vi faktisk kan stole på i 2D.

Filosofi: heller droppe en måling enn å gjette. Hver måling gates på
landmark-visibility. Det Gemini ikke får oppgitt, skal det ikke gjette på.
"""

import glob
import math
import os
import tempfile

import cv2
import ffmpeg
import numpy as np

from app.schemas import SwingMetric

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "pose_landmarker_lite.task")
SEG_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "selfie_segmenter.tflite")

# MediaPipe Pose landmark-indekser (33-punkts modell)
NOSE = 0
L_EYE, R_EYE = 2, 5
L_SH, R_SH = 11, 12
L_WR, R_WR = 15, 16
L_HIP, R_HIP = 23, 24
L_KNEE, R_KNEE = 25, 26
L_ANK, R_ANK = 27, 28

TARGET_FPS = 30
ASSUMED_HEIGHT_M = 1.40  # antatt ankel→skulder-høyde, for grov cm-skala
VIS_DROP = 0.5           # under dette: dropp målingen
VIS_HIGH = 0.8           # over dette: høy konfidens


def _extract_frames(video_bytes: bytes, content_type: str) -> tuple[list, int, int]:
    """Trekker ut hele videoen som RGB-frames @ 30fps, maks 960px bred.

    Tvinger fps=30 i ffmpeg — løser iOS slow-mo-metadata uten å bry oss om
    reell hastighet, siden posisjoner (ikke fart) er det vi måler her.
    """
    suffix = ".mov" if "quicktime" in content_type else ".mp4"
    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, f"input{suffix}")
        with open(video_path, "wb") as f:
            f.write(video_bytes)

        frames_dir = os.path.join(tmpdir, "frames")
        os.makedirs(frames_dir)
        (
            ffmpeg
            .input(video_path)
            .filter("fps", fps=TARGET_FPS)
            .filter("scale", "min(960,iw)", -2)
            .output(os.path.join(frames_dir, "frame_%05d.jpg"), vcodec="mjpeg", qscale=3)
            .run(quiet=True)
        )

        paths = sorted(glob.glob(os.path.join(frames_dir, "*.jpg")))
        frames = [
            cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            for p in paths
            if (img := cv2.imread(p)) is not None
        ]

    if not frames:
        return [], 0, 0
    h, w = frames[0].shape[:2]
    print(f"[pose] Ekstrahert {len(frames)} frames @ {TARGET_FPS}fps ({w}x{h})")
    return frames, w, h


def _run_pose(frames: list) -> list:
    """Kjører PoseLandmarker per frame. Returnerer liste av np.array (33,3):
    [x_norm, y_norm, visibility] — eller None for frames uten deteksjon."""
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    opts = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
    )
    series: list = []
    with vision.PoseLandmarker.create_from_options(opts) as landmarker:
        for i, frame in enumerate(frames):
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)
            ts = int(i / TARGET_FPS * 1000)
            res = landmarker.detect_for_video(mp_img, ts)
            if res.pose_landmarks:
                lms = res.pose_landmarks[0]
                series.append(np.array([[p.x, p.y, p.visibility] for p in lms]))
            else:
                series.append(None)
    n_ok = sum(1 for s in series if s is not None)
    print(f"[pose] Deteksjon i {n_ok}/{len(series)} frames")
    return series


def _find_keyframes(series: list, lead_wrist: int) -> dict | None:
    """Finner address/top/impact via ledende håndledds y-bane (lav→høy→lav).

    Returnerer None hvis bevegelsen ikke ser ut som en full sving.
    """
    ys = np.array([s[lead_wrist, 1] if s is not None else np.nan for s in series])
    valid = ~np.isnan(ys)
    if valid.sum() < 8:
        return None
    # interpoler hull
    idx = np.arange(len(ys))
    ys = np.interp(idx, idx[valid], ys[valid])
    # glatt
    k = 3
    ys = np.convolve(ys, np.ones(k) / k, mode="same")

    top = int(np.argmin(ys))                       # høyeste hender
    addr = int(np.argmax(ys[: top + 1])) if top > 0 else 0
    rise = ys[addr] - ys[top]                       # hvor mye hendene steg (y ned)
    if rise < 0.10:                                 # mindre enn 10% av høyden → ikke en sving
        return None
    if top >= len(ys) - 1:
        impact = len(ys) - 1
    else:
        seg = ys[top:]
        impact = top + int(np.argmin(np.abs(seg - ys[addr])))
    print(f"[pose] Nøkkelframes: address={addr} top={top} impact={impact}")
    return {"address": addr, "top": top, "impact": impact}


# ─── måle-hjelpere ──────────────────────────────────────────────────────────

def _px(lm, i, w, h):
    return np.array([lm[i, 0] * w, lm[i, 1] * h])


def _scale_m_per_px(lm, w, h) -> float | None:
    sh_y = (lm[L_SH, 1] + lm[R_SH, 1]) / 2 * h
    ank_y = (lm[L_ANK, 1] + lm[R_ANK, 1]) / 2 * h
    span = abs(ank_y - sh_y)
    return ASSUMED_HEIGHT_M / span if span > 1 else None


def _vis(lm, *idxs) -> float:
    return float(np.mean([lm[i, 2] for i in idxs]))


def _conf(v: float) -> str | None:
    if v < VIS_DROP:
        return None
    return "high" if v >= VIS_HIGH else "medium"


def _angle(a, b, c) -> float:
    """Vinkel ABC i grader."""
    v1, v2 = a - b, c - b
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return math.degrees(math.acos(np.clip(cos, -1, 1)))


def _compute_metrics(series, keys, view, handedness, w, h) -> list[SwingMetric]:
    addr_lm = series[keys["address"]]
    top_lm = series[keys["top"]]
    imp_lm = series[keys["impact"]]
    if addr_lm is None or top_lm is None or imp_lm is None:
        return []

    scale = _scale_m_per_px(addr_lm, w, h)
    lead_wrist = L_WR if handedness == "right" else R_WR
    trail_knee, trail_hip, trail_ank = (
        (R_KNEE, R_HIP, R_ANK) if handedness == "right" else (L_KNEE, L_HIP, L_ANK)
    )
    metrics: list[SwingMetric] = []

    def cm(px_dist: float) -> int:
        return round(px_dist * scale * 100) if scale else 0

    # 1) Hodebevegelse — lateral sway (address→top) og dip/lift gjennom svingen
    v = min(_vis(addr_lm, NOSE), _vis(top_lm, NOSE))
    c = _conf(v)
    if c and scale:
        nose_addr = _px(addr_lm, NOSE, w, h)
        nose_top = _px(top_lm, NOSE, w, h)
        sway = cm(abs(nose_top[0] - nose_addr[0]))
        # dip/lift: maks vertikal avvik fra address over hele serien
        nose_ys = [s[NOSE, 1] * h for s in series[keys["address"]: keys["impact"] + 1] if s is not None]
        drop = cm(max(nose_ys) - nose_addr[1]) if nose_ys else 0
        verdict = "stabilt" if sway <= 5 and abs(drop) <= 5 else f"{sway} cm sideveis, {drop} cm vertikalt"
        metrics.append(SwingMetric(
            label="Hodebevegelse", value=f"{sway} cm" if sway else "stabilt",
            detail=f"sideveis address→topp; {drop} cm vertikalt gjennom svingen", confidence=c,
        ))

    # 2) Ryggvinkel / early extension — hofte→skulder-vektor vs vertikal, address vs impact
    v = min(_vis(addr_lm, L_SH, R_SH, L_HIP, R_HIP), _vis(imp_lm, L_SH, R_SH, L_HIP, R_HIP))
    c = _conf(v)
    if c:
        def tilt(lm):
            sh = (_px(lm, L_SH, w, h) + _px(lm, R_SH, w, h)) / 2
            hip = (_px(lm, L_HIP, w, h) + _px(lm, R_HIP, w, h)) / 2
            return math.degrees(math.atan2(abs(sh[0] - hip[0]), abs(sh[1] - hip[1])))
        t_addr, t_imp = round(tilt(addr_lm)), round(tilt(imp_lm))
        delta = t_addr - t_imp
        detail = (f"reiste seg {delta}° (mulig early extension)" if delta >= 8
                  else "beholdt positur" if abs(delta) < 8 else f"økte tilt {-delta}°")
        metrics.append(SwingMetric(
            label="Ryggvinkel", value=f"{t_addr}° → {t_imp}°",
            detail=detail, confidence=c,
        ))

    # 3) Bakre kne — fleks i adresse vs topp (rettes det ut = tap av base)
    v = min(_vis(addr_lm, trail_hip, trail_knee, trail_ank),
            _vis(top_lm, trail_hip, trail_knee, trail_ank))
    c = _conf(v)
    if c:
        a_addr = _angle(_px(addr_lm, trail_hip, w, h), _px(addr_lm, trail_knee, w, h), _px(addr_lm, trail_ank, w, h))
        a_top = _angle(_px(top_lm, trail_hip, w, h), _px(top_lm, trail_knee, w, h), _px(top_lm, trail_ank, w, h))
        straighten = round(a_top - a_addr)
        detail = (f"rettet seg {straighten}° i backswing" if straighten >= 12
                  else "beholdt fleks")
        metrics.append(SwingMetric(
            label="Bakre kne", value=f"{round(a_addr)}° → {round(a_top)}°",
            detail=detail, confidence=c,
        ))

    # 4) Hofteforskyvning — lateral slide address→impact (mest meningsfull face-on)
    if view == "face_on":
        v = min(_vis(addr_lm, L_HIP, R_HIP), _vis(imp_lm, L_HIP, R_HIP))
        c = _conf(v)
        if c and scale:
            hip_addr = (_px(addr_lm, L_HIP, w, h) + _px(addr_lm, R_HIP, w, h)) / 2
            hip_imp = (_px(imp_lm, L_HIP, w, h) + _px(imp_lm, R_HIP, w, h)) / 2
            slide = cm(abs(hip_imp[0] - hip_addr[0]))
            metrics.append(SwingMetric(
                label="Hofteforskyvning", value=f"{slide} cm",
                detail="sideveis glid address→impact", confidence=c,
            ))

    return metrics


def analyze_pose(video_bytes: bytes, content_type: str, view: str,
                 handedness: str) -> list[SwingMetric]:
    """Hele pipelinen: frames → pose → nøkkelframes → målinger."""
    frames, w, h = _extract_frames(video_bytes, content_type)
    if not frames:
        return []
    series = _run_pose(frames)
    lead_wrist = L_WR if handedness == "right" else R_WR
    keys = _find_keyframes(series, lead_wrist)
    if keys is None:
        print("[pose] Fant ikke gyldig sving-bevegelse — ingen målinger")
        return []
    return _compute_metrics(series, keys, view, handedness, w, h)


def _find_body_edges(frame_rgb: np.ndarray, lm: np.ndarray) -> dict:
    """Selfie-segmentering på ett frame → finner toppen av hodet og utsiden av rumpa.

    Bruker MediaPipe Tasks ImageSegmenter.
    Returnerer normaliserte koordinater (0–1) eller None der deteksjonen feiler.
    """
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision

    h, w = frame_rgb.shape[:2]
    opts = vision.ImageSegmenterOptions(
        base_options=python.BaseOptions(model_asset_path=SEG_MODEL_PATH),
        output_confidence_masks=True,
    )
    img = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
    with vision.ImageSegmenter.create_from_options(opts) as seg:
        seg_result = seg.segment(img)
        mask = seg_result.confidence_masks[0].numpy_view()[:, :, 0] > 0.5  # (h, w) bool

    result = {}

    # Utsiden av rumpa: ved hoftenivå, ytterste maskepiksel på baksiden
    hip_y_norm = (lm[L_HIP, 1] + lm[R_HIP, 1]) / 2
    hip_y_px = int(np.clip(hip_y_norm * h, 0, h - 1))
    row_slice = slice(max(0, hip_y_px - 5), min(h, hip_y_px + 6))
    hip_cols = np.any(mask[row_slice, :], axis=0)  # (w,) bool

    if hip_cols.any():
        nose_x = lm[NOSE, 0]
        hip_x = (lm[L_HIP, 0] + lm[R_HIP, 0]) / 2
        facing_right = nose_x > hip_x  # nesa til høyre → rumpa til venstre
        if facing_right:
            result["butt_edge_x"] = float(np.argmax(hip_cols)) / w
        else:
            result["butt_edge_x"] = float(w - 1 - np.argmax(hip_cols[::-1])) / w

    return result


def analyze_pose_lines(video_bytes: bytes, content_type: str,
                       handedness: str = "right") -> dict | None:
    """Returnerer normaliserte ledd-posisjoner i address-frame for referanselinjer
    (hode, skuldre, hofter). Null-felt der landmarket ikke var synlig nok."""
    frames, w, h = _extract_frames(video_bytes, content_type)
    if not frames:
        return None
    series = _run_pose(frames)
    lead_wrist = L_WR if handedness == "right" else R_WR
    keys = _find_keyframes(series, lead_wrist)
    if keys is None:
        print("[pose] Fant ikke gyldig sving-bevegelse — ingen linjer")
        return None
    addr = keys["address"]
    # Median over et lite vindu rundt address → demper enkeltframe-støy.
    window = [series[i] for i in range(max(0, addr - 2), min(len(series), addr + 3))
              if series[i] is not None]
    if not window:
        return None
    lm = np.median(np.stack(window), axis=0)  # (33, 3)

    def pt(i):
        if lm[i, 2] < VIS_DROP:
            return None
        return {"x": float(lm[i, 0]), "y": float(lm[i, 1])}

    edges = _find_body_edges(frames[addr], lm)

    # Topp av hode fra øye-landmarks — stabilt uavhengig av hår/lys/caps.
    # Øyet er ~midtveis i ansiktet vertikalt; toppen av hodet er omtrent like
    # langt over øyet som øyet er over nesen.
    eye_vis_l = float(lm[L_EYE, 2])
    eye_vis_r = float(lm[R_EYE, 2])
    best_eye = lm[L_EYE] if eye_vis_l >= eye_vis_r else lm[R_EYE]
    if max(eye_vis_l, eye_vis_r) > VIS_DROP:
        eye_to_nose_gap = lm[NOSE, 1] - best_eye[1]   # positivt: nesen er under øyet
        head_top_y = float(best_eye[1] - eye_to_nose_gap * 4)
    else:
        head_top_y = edges.get("head_top_y")           # fall back til segmentering

    return {
        "nose": pt(NOSE),
        "left_shoulder": pt(L_SH),
        "right_shoulder": pt(R_SH),
        "left_hip": pt(L_HIP),
        "right_hip": pt(R_HIP),
        "left_wrist": pt(L_WR),
        "right_wrist": pt(R_WR),
        "left_ankle": pt(L_ANK),
        "right_ankle": pt(R_ANK),
        "video_width": w,
        "video_height": h,
        "address_frame": addr,
        "fps": float(TARGET_FPS),
        "head_top_y": head_top_y,
        "butt_edge_x": edges.get("butt_edge_x"),
    }


def metrics_to_prompt(metrics: list[SwingMetric]) -> str:
    """Formaterer målingene til en faktablokk Gemini skal stole på."""
    if not metrics:
        return ""
    lines = "\n".join(
        f"- {m.label}: {m.value} — {m.detail} ({m.confidence} confidence)"
        for m in metrics
    )
    return (
        "\n\nMEASURED DATA (computed from pose estimation — trust these numbers "
        "over any visual guess):\n"
        f"{lines}\n"
        "Any body metric NOT listed here could not be reliably measured from this "
        "camera angle — do not guess it."
    )

