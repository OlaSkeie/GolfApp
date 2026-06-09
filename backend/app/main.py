from fastapi import FastAPI, File, UploadFile

from app.schemas import SwingReview
from app.services.gemini import review_swing

app = FastAPI(title="Golf Swing AI")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/reviews", response_model=SwingReview)
async def create_review(video: UploadFile = File(...)) -> SwingReview:
    """Ta imot en swing-video og returner en AI-tilbakemelding."""
    video_bytes = await video.read()
    return await review_swing(video_bytes, video.content_type or "video/mp4")
