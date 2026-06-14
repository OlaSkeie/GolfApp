"""Shot trace: bruker-angitt tee-posisjon → YOLO full-frame sweep → Kalman+crop loop → parabolsk gap-fill."""

import asyncio
import glob
import math
import os
import tempfile
from pathlib import Path

import ffmpeg

from app.schemas import ShotTraceResult, TrackedPoint

try:
    import cv2
    import numpy as np
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False

try:
    from filterpy.kalman import KalmanFilter as _KalmanFilter
except ImportError:
    _KalmanFilter = None  # type: ignore
    print("[shot_trace] filterpy ikke tilgjengelig")

try:
    from ultralytics import YOLO as _YOLO
    from sahi import AutoDetectionModel as _AutoDetectionModel
    from sahi.predict import get_sliced_prediction as _get_sliced_prediction
    import PIL.Image as _PILImage  # type: ignore
    _MODEL_PATH = Path(__file__).parent.parent.parent / "models" / "best.pt"
    _model: _YOLO | None = _YOLO(str(_MODEL_PATH)) if _MODEL_PATH.exists() else None
    _sahi_model = _AutoDetectionModel.from_pretrained(
        "ultralytics", model_path=str(_MODEL_PATH), confidence_threshold=0.00,
    ) if _MODEL_PATH.exists() else None
    _HAS_YOLO = _model is not None
    if not _HAS_YOLO:
        print(f"[shot_trace] YOLO-modell ikke funnet: {_MODEL_PATH}")
except Exception as e:
    _model = None
    _sahi_model = None
    _HAS_YOLO = False
    print(f"[shot_trace] YOLO ikke tilgjengelig: {e}")



# ─── Kalman ───────────────────────────────────────────────────────────────────

def _make_kalman(cx: float, cy: float, vx: float, vy: float):
    kf = _KalmanFilter(dim_x=4, dim_z=2)
    kf.F = np.array([[1, 0, 1, 0],
                     [0, 1, 0, 1],
                     [0, 0, 1, 0],
                     [0, 0, 0, 1]], dtype=float)
    kf.H  = np.array([[1, 0, 0, 0], [0, 1, 0, 0]], dtype=float)
    kf.R  = np.diag([25.0, 25.0])
    kf.Q  = np.diag([4.0, 4.0, 400.0, 400.0])
    kf.x  = np.array([cx, cy, vx, vy]).reshape(4, 1)
    kf.P  = np.diag([50.0, 50.0, 100.0, 100.0])
    return kf


# ─── Frame extraction ─────────────────────────────────────────────────────────

def _extract_frames(
    video_bytes: bytes,
    content_type: str,
    impact_time_sec: float = 0.0,
    pre_impact_sec: float = 0.5,
    post_impact_sec: float = 3.0,
) -> tuple[list, float, int, int, int]:
    """
    Returnerer (frames, fps, width, height, impact_frame_index).
    Trekker ut kun vinduet rundt impact ved nativ fps — ingen nedskalering.
    """
    suffix = '.mov' if 'quicktime' in content_type else '.mp4'

    with tempfile.TemporaryDirectory() as tmpdir:
        video_path = os.path.join(tmpdir, f'input{suffix}')
        with open(video_path, 'wb') as f:
            f.write(video_bytes)

        probe = ffmpeg.probe(video_path)
        video_stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')

        fps_str = video_stream.get('r_frame_rate', '30/1')
        num, den = map(int, fps_str.split('/'))
        native_fps = num / max(den, 1)
        print(f"[shot_trace] Native fps: {native_fps:.1f} (ingen nedskalering)")

        width  = int(video_stream['width'])
        height = int(video_stream['height'])
        total_duration = float(probe['format']['duration'])

        start_sec = max(0.0, impact_time_sec - pre_impact_sec)
        end_sec   = min(total_duration, impact_time_sec + post_impact_sec)
        window    = end_sec - start_sec

        frames_dir = os.path.join(tmpdir, 'frames')
        os.makedirs(frames_dir)

        (
            ffmpeg
            .input(video_path, ss=start_sec, t=window)
            .filter('scale', 'min(1280,iw)', -2)
            .output(os.path.join(frames_dir, 'frame_%05d.jpg'), vcodec='mjpeg', qscale=3)
            .run(quiet=True)
        )

        frame_paths = sorted(glob.glob(os.path.join(frames_dir, '*.jpg')))
        frames = [img for p in frame_paths if (img := cv2.imread(p)) is not None]

        if frames:
            actual_h, actual_w = frames[0].shape[:2]
            if actual_w != width or actual_h != height:
                print(f"[shot_trace] Rotert video: probe={width}x{height} → faktisk={actual_w}x{actual_h}")
            width, height = actual_w, actual_h

        # Faktisk fps fra reellt antall frames (korrigerer iOS slow-mo metadata-mismatch)
        actual_fps = len(frames) / window if (window > 0 and frames) else native_fps
        if abs(actual_fps - native_fps) / max(native_fps, 1) > 0.15:
            print(f"[shot_trace] FPS-mismatch: probe={native_fps:.1f} faktisk={actual_fps:.1f} — bruker faktisk")
            native_fps = actual_fps

        # impact_frame er antall frames inn i det uttrukne vinduet
        impact_frame_idx = round(pre_impact_sec * native_fps)
        impact_frame_idx = max(0, min(impact_frame_idx, len(frames) - 1))

        print(f"[shot_trace] Ekstrahert {len(frames)} frames @ {native_fps:.0f}fps "
              f"({start_sec:.2f}s–{end_sec:.2f}s), impact_frame={impact_frame_idx}")

        return frames, native_fps, width, height, impact_frame_idx


# ─── YOLO helpers ─────────────────────────────────────────────────────────────

def _yolo_on_frame(frame, conf: float, exclude_pos=None, exclude_r: float = 0,
                   use_sahi: bool = False):
    if use_sahi and _sahi_model is not None:
        pil = _PILImage.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        result = _get_sliced_prediction(
            pil, _sahi_model,
            slice_height=640, slice_width=640,
            overlap_height_ratio=0.2, overlap_width_ratio=0.2,
            verbose=0,
        )
        hits = []
        for pred in result.object_prediction_list:
            if pred.score.value < conf:
                continue
            b = pred.bbox
            cx, cy = (b.minx + b.maxx) / 2, (b.miny + b.maxy) / 2
            if exclude_pos and math.hypot(cx - exclude_pos[0], cy - exclude_pos[1]) < exclude_r:
                continue
            hits.append((cx, cy, pred.score.value))
        return hits

    results = _model(frame, verbose=False, conf=conf)
    hits = []
    for box in results[0].boxes:
        cx, cy = float(box.xywh[0][0]), float(box.xywh[0][1])
        c = float(box.conf[0])
        if exclude_pos and math.hypot(cx - exclude_pos[0], cy - exclude_pos[1]) < exclude_r:
            continue
        hits.append((cx, cy, c))
    return hits


def _yolo_on_crop(frame, pred_cx: float, pred_cy: float,
                  crop_r: int, width: int, height: int):
    x1 = max(0, int(pred_cx - crop_r))
    y1 = max(0, int(pred_cy - crop_r))
    x2 = min(width,  int(pred_cx + crop_r))
    y2 = min(height, int(pred_cy + crop_r))
    if x2 <= x1 or y2 <= y1:
        return None

    crop = frame[y1:y2, x1:x2]
    hits = _yolo_on_frame(crop, conf=0.10)
    if not hits:
        return None

    bx, by, _ = max(hits, key=lambda h: h[2])
    return (x1 + bx, y1 + by)


# ─── Parabola gap-fill ────────────────────────────────────────────────────────

def _fit_parabola(
    confirmed: list[tuple[int, float, float]],
    width: int,
    height: int,
) -> list[tuple[float, float, int]]:
    """Interpoler lineært mellom bekreftede punkter. Ingen ekstrapolasjon."""
    if len(confirmed) < 2:
        return [(cx / width, cy / height, fi) for fi, cx, cy in confirmed]

    result: list[tuple[float, float, int]] = []
    for i in range(len(confirmed) - 1):
        f0, x0, y0 = confirmed[i]
        f1, x1, y1 = confirmed[i + 1]
        for fi in range(f0, f1):
            t = (fi - f0) / (f1 - f0)
            cx = x0 + t * (x1 - x0)
            cy = y0 + t * (y1 - y0)
            result.append((cx / width, cy / height, fi))

    # Legg til siste punkt
    fi, cx, cy = confirmed[-1]
    result.append((cx / width, cy / height, fi))
    return result


# ─── Ball trajectory ──────────────────────────────────────────────────────────

def _detect_ball_trajectory(
    frames: list,
    impact_frame: int,
    tee_cx: float,
    tee_cy: float,
    fps: float,
    width: int,
    height: int,
) -> list[tuple[float, float, int]]:
    if not frames or not _HAS_YOLO:
        return []

    end_frame = len(frames)

    # Startpunkt er alltid den bruker-angitte tee-posisjonen
    confirmed: list[tuple[int, float, float]] = [(impact_frame, tee_cx, tee_cy)]

    # ── Fase 2a: sweep for å etablere hastighet ──────────────────────────────
    # Første frame: full-frame for å finne første deteksjon.
    # Deretter: crop rundt forventet posisjon basert på akkumulert hastighet.
    init_end   = min(end_frame, impact_frame + max(8, int(fps * 0.15)))
    tee_excl_r = 25.0
    prev_xy    = (tee_cx, tee_cy)
    init_vx, init_vy = 0.0, 0.0  # oppdateres etter første funn

    for fi in range(impact_frame + 1, init_end):
        if len(confirmed) == 1:
            # Ingen hastighet ennå — søk full frame
            hits = _yolo_on_frame(frames[fi], conf=0.15,
                                  exclude_pos=(tee_cx, tee_cy), exclude_r=tee_excl_r,
                                  use_sahi=True)
            candidates = [
                (cx, cy, c) for cx, cy, c in hits
                if cy < prev_xy[1]
            ]
            if not candidates:
                continue
            cx, cy, _ = max(candidates, key=lambda h: h[2])
        else:
            # Har hastighet — bruk crop rundt predikert posisjon
            dt = fi - confirmed[-1][0]
            pred_cx = prev_xy[0] + init_vx * dt
            pred_cy = prev_xy[1] + init_vy * dt
            init_crop_r = int(np.clip(math.hypot(init_vx, init_vy) * 3, 60, 250))
            det = _yolo_on_crop(frames[fi], pred_cx, pred_cy, init_crop_r, width, height)
            if det is None:
                continue
            cx, cy = det
            if cy >= prev_xy[1]:
                continue

        dist = math.hypot(cx - prev_xy[0], cy - prev_xy[1])
        if dist < 5:
            continue
        confirmed.append((fi, cx, cy))
        # oppdater hastighetsestimat
        dt0 = fi - confirmed[-2][0]
        init_vx = (cx - prev_xy[0]) / max(1, dt0)
        init_vy = (cy - prev_xy[1]) / max(1, dt0)
        prev_xy = (cx, cy)
        print(f"[shot_trace]   init frame {fi}: ({cx:.0f},{cy:.0f}) vx={init_vx:.1f} vy={init_vy:.1f}")

    if len(confirmed) < 2:
        print("[shot_trace] Klarte ikke etablere hastighet")
        return [(tee_cx / width, tee_cy / height, impact_frame)]

    # ── Kalman initialisering — fysikkbasert ─────────────────────────────────
    ts_c = np.array([f - confirmed[0][0] for f, _, _ in confirmed], dtype=float)
    xs_c = np.array([x for _, x, _ in confirmed], dtype=float)
    ys_c = np.array([y for _, _, y in confirmed], dtype=float)

    # x er lineær (ingen horisontal akselerasjon)
    px   = np.polyfit(ts_c, xs_c, 1)
    vx0  = float(px[0])

    # y er parabolsk: y = c*t² + b*t + a  →  a_y = 2*c  (px/frame²)
    # Med < 3 punkter faller vi tilbake til lineær
    if len(confirmed) >= 3:
        py   = np.polyfit(ts_c, ys_c, 2)
        vy0  = float(py[1])   # initialhastighet ved t=0 (impact)
        g_px = float(2 * py[0])  # gravitasjon i px/frame² (positiv = nedover)
    else:
        py   = np.polyfit(ts_c, ys_c, 1)
        vy0  = float(py[0])
        g_px = 0.3  # konservativt estimat

    g_px = float(np.clip(g_px, 0.05, 15.0))  # sanity-sjekk
    print(f"[shot_trace] Fysikk: vx0={vx0:.1f} vy0={vy0:.1f} g_px={g_px:.3f}px/frame²")

    _, xb, yb = confirmed[-1]
    t_last = float(confirmed[-1][0] - confirmed[0][0])
    vy_now = vy0 + g_px * t_last
    speed  = math.hypot(vx0, vy_now)
    crop_r = int(np.clip(speed * 2.5, 150, 300))
    kf     = _make_kalman(xb, yb, vx0, vy_now)
    misses = 0

    # Laveste cy-verdi sett (= høyeste punkt i bildet)
    min_cy = min(c[2] for c in confirmed)

    # ── Fase 2b: Kalman + crop-loop ───────────────────────────────────────────
    for fi in range(confirmed[-1][0] + 1, end_frame):
        kf.predict()
        # Gravitasjon: legg til akselerasjon manuelt etter predict
        kf.x[1, 0] += 0.5 * g_px   # posisjon
        kf.x[3, 0] += g_px          # hastighet
        pred_cx = float(kf.x[0, 0])
        pred_cy = float(kf.x[1, 0])

        if pred_cx < -crop_r or pred_cx > width + crop_r or pred_cy < -crop_r or pred_cy > height + crop_r:
            print(f"[shot_trace] Prediksjon utenfor frame ved {fi}, stopper")
            break

        det = _yolo_on_crop(frames[fi], pred_cx, pred_cy, crop_r, width, height)

        if det is not None:
            cx, cy = det
            dist_pred = math.hypot(cx - pred_cx, cy - pred_cy)

            if math.hypot(cx - tee_cx, cy - tee_cy) < tee_excl_r:
                print(f"[shot_trace]   frame {fi}: FORKASTET tee ({cx:.0f},{cy:.0f})")
                continue
            if cy >= tee_cy:
                print(f"[shot_trace]   frame {fi}: Ballen tilbake på bakkenivå, stopper")
                break
            if dist_pred > crop_r:
                print(f"[shot_trace]   frame {fi}: FORKASTET for langt dist={dist_pred:.0f} crop_r={crop_r}")
                misses += 1
                continue
            # Avvis nesten-stasjonære deteksjoner (sannsynligvis bakgrunnsobjekt)
            dist_last = math.hypot(cx - confirmed[-1][1], cy - confirmed[-1][2])
            min_move = max(3.0, speed * 0.08)
            if dist_last < min_move:
                print(f"[shot_trace]   frame {fi}: FORKASTET for lite bevegelse dist_last={dist_last:.1f} min={min_move:.1f}")
                misses += 1
                continue
            # Stor avstand fra prediksjon → øk målestøy for å dempe Kalman-korreksjon
            noise_scale = 1.0 + (dist_pred / crop_r) ** 2 * 10
            kf.R = np.diag([25.0 * noise_scale, 25.0 * noise_scale])
            kf.update(np.array([[cx], [cy]]))
            kf.R = np.diag([25.0, 25.0])
            confirmed.append((fi, cx, cy))
            min_cy = min(min_cy, cy)
            misses = 0
            print(f"[shot_trace]   frame {fi}: OK ({cx:.0f},{cy:.0f}) dist_pred={dist_pred:.0f}")
        else:
            misses += 1
            print(f"[shot_trace]   frame {fi}: INGEN DET pred=({pred_cx:.0f},{pred_cy:.0f}) crop_r={crop_r}")

            # Etter noen misses: prøv full-frame re-søk for å gjenfinne ballen
            if misses == int(fps * 0.15):
                hits = _yolo_on_frame(frames[fi], conf=0.10,
                                      exclude_pos=(tee_cx, tee_cy), exclude_r=tee_excl_r,
                                      use_sahi=True)
                candidates = [
                    (cx, cy, c) for cx, cy, c in hits
                    if cy < tee_cy and cy < min_cy + max(40.0, abs(vy0) * 1.0)
                ]
                if candidates:
                    cx, cy, _ = min(candidates, key=lambda h: math.hypot(h[0] - pred_cx, h[1] - pred_cy))
                    dist_full = math.hypot(cx - pred_cx, cy - pred_cy)
                    print(f"[shot_trace]   frame {fi}: FULL-FRAME re-søk fant ({cx:.0f},{cy:.0f}) dist={dist_full:.0f}")
                    kf.update(np.array([[cx], [cy]]))
                    confirmed.append((fi, cx, cy))
                    min_cy = min(min_cy, cy)
                    misses = 0

            if misses > int(fps * 0.4):
                print(f"[shot_trace] Mistet ballen ved frame {fi}")
                break

    print(f"[shot_trace] {len(confirmed)} bekreftede punkter → gap-fill")
    return _fit_parabola(confirmed, width, height)


# ─── Entry point ──────────────────────────────────────────────────────────────

def _sync_analyze(
    video_bytes: bytes,
    content_type: str,
    tee_x_pct: float,
    tee_y_pct: float,
    impact_time_sec: float,
) -> ShotTraceResult:
    print(f"[shot_trace] Mottok video: {len(video_bytes)//1024} KB, tee=({tee_x_pct:.3f},{tee_y_pct:.3f})")

    if not _HAS_CV2:
        return ShotTraceResult(
            impact_frame=0, fps=30.0, duration=0.0,
            video_width=1920, video_height=1080, tracked_points=[],
        )

    pre_impact_sec = 0.5
    frames, fps, width, height, impact_frame = _extract_frames(
        video_bytes, content_type, impact_time_sec=impact_time_sec,
        pre_impact_sec=pre_impact_sec, post_impact_sec=6.0,
    )
    window_start_sec = max(0.0, impact_time_sec - pre_impact_sec)
    print(f"[shot_trace] {len(frames)} frames @ {fps:.0f}fps, {width}x{height}")

    if not frames:
        return ShotTraceResult(
            impact_frame=0, fps=fps, duration=0.0,
            video_width=width, video_height=height, tracked_points=[],
        )

    tee_cx = tee_x_pct * width
    tee_cy = tee_y_pct * height
    print(f"[shot_trace] Tee-posisjon: ({tee_cx:.0f}, {tee_cy:.0f}), impact_frame={impact_frame}")

    tracked = _detect_ball_trajectory(frames, impact_frame, tee_cx, tee_cy, fps, width, height)

    # Sett alltid eksakt tee-posisjon som første punkt
    tee_point = (tee_cx / width, tee_cy / height, impact_frame)
    if tracked and tracked[0][2] == impact_frame:
        tracked[0] = tee_point
    else:
        tracked = [tee_point] + tracked

    print(f"[shot_trace] Fant {len(tracked)} sporingspunkter")

    duration = len(frames) / fps  # lengde på det uttrukne vinduet
    return ShotTraceResult(
        impact_frame=impact_frame,
        fps=fps,
        duration=duration,
        window_start_sec=window_start_sec,
        video_width=width,
        video_height=height,
        tracked_points=[TrackedPoint(x_pct=x, y_pct=y, frame=f) for x, y, f in tracked],
    )


async def analyze_shot(
    video_bytes: bytes,
    content_type: str,
    tee_x_pct: float,
    tee_y_pct: float,
    impact_time_sec: float,
) -> ShotTraceResult:
    return await asyncio.to_thread(
        _sync_analyze, video_bytes, content_type, tee_x_pct, tee_y_pct, impact_time_sec,
    )
