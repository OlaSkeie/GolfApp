import asyncio
import json
from typing import Annotated

from fastapi import FastAPI, File, Form, UploadFile

from fastapi import HTTPException

from app.schemas import PoseLines, ShotTraceResult, SwingReview
from app.services.gemini import review_swing
from app.services.pose_metrics import analyze_pose_lines
from app.services.shot_trace import analyze_shot

app = FastAPI(title="Golf Swing AI")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/reviews", response_model=SwingReview)
async def create_review(
    videos: Annotated[list[UploadFile], File()],
    metadata: Annotated[str, Form()],
    user_question: Annotated[str | None, Form()] = None,
    profile: Annotated[str | None, Form()] = None,
) -> SwingReview:
    meta_list: list[dict] = json.loads(metadata)
    profile_data: dict = json.loads(profile) if profile else {}
    video_data = [
        (
            await v.read(),
            v.content_type or "video/mp4",
            meta_list[i].get("angle", "dtl") if i < len(meta_list) else "dtl",
            meta_list[i].get("handedness", "right") if i < len(meta_list) else "right",
        )
        for i, v in enumerate(videos)
    ]
    return await review_swing(video_data, user_question or None, profile_data)


@app.post("/pose-lines", response_model=PoseLines)
async def create_pose_lines(
    video: UploadFile = File(...),
    handedness: str = Form("right"),
) -> PoseLines:
    video_bytes = await video.read()
    result = await asyncio.to_thread(
        analyze_pose_lines, video_bytes, video.content_type or "video/mp4", handedness,
    )
    if result is None:
        raise HTTPException(status_code=422, detail="Fant ingen address-stilling i videoen")
    return PoseLines(**result)


@app.post("/shot-trace", response_model=ShotTraceResult)
async def create_shot_trace(
    video: UploadFile = File(...),
    tee_x_pct: float = Form(...),
    tee_y_pct: float = Form(...),
    impact_time_sec: float = Form(...),
) -> ShotTraceResult:
    video_bytes = await video.read()
    return await analyze_shot(
        video_bytes, video.content_type or "video/mp4",
        tee_x_pct, tee_y_pct, impact_time_sec,
    )
