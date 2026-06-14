from datetime import datetime

from pydantic import BaseModel


class SwingPhase(BaseModel):
    name: str
    note: str


class SwingMetric(BaseModel):
    label: str        # f.eks. "Hodebevegelse"
    value: str        # f.eks. "12 cm"
    detail: str       # kort, nøytral beskrivelse
    confidence: str   # "high" | "medium" | "low"


class SwingReview(BaseModel):
    summary: str
    phases: list[SwingPhase]
    metrics: list[SwingMetric] = []
    created_at: datetime


class PosePoint(BaseModel):
    x: float   # 0–1 relative to frame width
    y: float   # 0–1 relative to frame height


class PoseLines(BaseModel):
    """Normaliserte ledd-posisjoner i address-frame, for referanselinjer.
    Null der landmarket ikke var synlig nok."""
    nose: PosePoint | None = None
    left_shoulder: PosePoint | None = None
    right_shoulder: PosePoint | None = None
    left_hip: PosePoint | None = None
    right_hip: PosePoint | None = None
    left_wrist: PosePoint | None = None
    right_wrist: PosePoint | None = None
    left_ankle: PosePoint | None = None
    right_ankle: PosePoint | None = None
    video_width: int
    video_height: int
    address_frame: int   # frame-indeks @ fps der address ble funnet
    fps: float           # frames per sekund brukt i analysen
    head_top_y: float | None = None    # normalisert y for toppen av hodet (segmentering)
    butt_edge_x: float | None = None   # normalisert x for utsiden av rumpa (segmentering)


class TrackedPoint(BaseModel):
    x_pct: float   # 0–1 relative to frame width
    y_pct: float   # 0–1 relative to frame height
    frame: int     # frame index (at the extracted fps)


class ShotTraceResult(BaseModel):
    impact_frame: int
    fps: float
    duration: float       # lengde på det uttrukne vinduet i sekunder
    window_start_sec: float  # når vinduet starter i originalvideoen
    video_width: int
    video_height: int
    tracked_points: list[TrackedPoint]
