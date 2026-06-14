"""Gemini swing analysis.

Without GEMINI_API_KEY: placeholder mode.
With a key: uploads all videos via Files API, sends a single coaching request.
No frame extraction — phases are assessed qualitatively without timestamps.
"""

import asyncio
import io
import time
from datetime import datetime, timezone

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import settings
from app.schemas import SwingMetric, SwingPhase, SwingReview
from app.services.pose_metrics import analyze_pose, metrics_to_prompt

MODEL = "gemini-2.5-flash-lite"

ANGLE_LABELS = {
    "dtl": "down the line",
    "face_on": "face-on (straight on)",
}


class _AiPhase(BaseModel):
    name: str
    note: str


class _AiReview(BaseModel):
    summary: str
    phases: list[_AiPhase]


def _profile_text(profile: dict) -> str:
    if not profile:
        return ""
    hcp = profile.get("handicap", "").strip()
    plays = profile.get("playsPerWeek", "")
    practices = profile.get("practicesPerWeek", "")
    lines = ["GOLFER PROFILE"]
    if hcp:
        lines.append(f"Handicap: {hcp}")
    if plays:
        lines.append(f"Plays: {plays}")
    if practices:
        lines.append(f"Practices: {practices}")
    lines.append("Calibrate your feedback and drill complexity to this level.")
    return "\n\n" + "\n".join(lines)


def _build_prompt(video_desc: str, view: str, user_question: str | None = None,
                  metrics_text: str = "", profile: dict | None = None) -> str:
    if view == "dtl":
        view_label = "down-the-line (camera behind the golfer, looking at the target)"
        view_checklist = (
            "VIEW-SPECIFIC CHECKPOINTS (down-the-line):\n"
            "These are what this camera angle reveals best. Only mention if clearly visible.\n"
            "- Club path through impact: is the club moving in-to-out, out-to-in, or square? "
            "Trace the clubhead through the hitting zone.\n"
            "- Swing plane: does the club stay on plane in the backswing and downswing, "
            "or does it lift above / drop below the plane line (shaft angle at address)?\n"
            "- Takeaway direction: does the clubhead move straight back along the target line, "
            "or yank inside / push outside?\n"
            "- Hand path in downswing: do the hands drop into the slot (inside), "
            "or do they move out toward the ball (over the top)?\n"
            "- Shaft at the top: across the line (pointing right of target, only mention if extreme), "
            "laid off (pointing left), or on plane (parallel to target line, only mention if extreme)?\n"
            "- Head movement: lateral sway off the ball in backswing, or lateral slide toward target in downswing?\n"
            "- Clubface at top: open (toe pointing at ground), closed (face pointing at sky), or square?\n"
        )
    else:
        view_label = "face-on (camera facing the golfer from the front/side)"
        view_checklist = (
            "VIEW-SPECIFIC CHECKPOINTS (face-on):\n"
            "These are what this camera angle reveals best. Only mention if clearly visible.\n"
            "- Weight shift: does weight load into the trail side in backswing "
            "and transfer to the lead side before the arms come down?\n"
            "- Hip rotation vs slide: do the hips rotate or just slide laterally toward the target?\n"
            "- Early extension: does the pelvis thrust toward the ball in the downswing "
            "(loss of spine angle / standing up)?\n"
            "- Shaft lean at impact: are the hands ahead of the clubhead (forward press), "
            "or is the player scooping/flipping (hands behind the ball)?\n"
            "- Head position: does the head stay centered or does it dip/rise significantly "
            "through the swing?\n"
            "- Lead arm at the top: roughly on or below the shoulder plane, "
            "or lifted above it (high hands)?\n"
            "- Knee flex: does the trail knee straighten completely (loss of base), "
            "or maintain flex through the backswing?\n"
            "- Follow-through: full rotation to a balanced finish facing the target, "
            "or does the body stall / chicken wing?\n"
        )

    return (
        "You are a blunt, experienced PGA tour coach reviewing a student's swing. "
        "Your job is accurate observation — not encouragement, not completeness. "
        f"Videos provided: {video_desc}.\n"
        f"Camera angle: {view_label}.\n\n"

        "TASK\n"
        "Watch the swing(s) and identify the 2–4 most impactful issues — root causes, not symptoms. "
        "Many faults are downstream of one upstream error; name the root, not every branch. "
        "If something is genuinely good, say so briefly. Do not invent problems.\n\n"
        "STRUCTURE YOUR RESPONSE AS:\n"
        "1. Overall impression — 2-3 sentences.\n"
        "2. Key findings — the 2-4 most important observations, each with:\n"
        "   • Phase (Address / Takeaway / Backswing / Top / Transition / Downswing / Impact / Follow-through)\n"
        "   • What you see — specific, visual language\n"
        "   • Why it matters — what it causes downstream\n"
        "   • One fix — a single drill or feel\n"
        "3. What works — 1-2 things the student should NOT change.\n\n"

        f"{view_checklist}\n"

        "GENERAL KNOWLEDGE BASE — mental checklist, not a template. "
        "Only mention items clearly visible as problems:\n"
        "- Grip: too strong/weak, pressure\n"
        "- Address: alignment, ball position, stance width, posture\n"
        "- Takeaway: one-piece vs hands-only, clubface rotation\n"
        "- Backswing: shoulder turn, hip turn, trail elbow, wrist hinge timing\n"
        "- Top: lead arm plane, shaft position, reverse pivot\n"
        "- Transition: lower body leads vs arms-first, lag retention vs casting\n"
        "- Downswing: club path, angle of attack\n"
        "- Impact: shaft lean, hip rotation, early extension, weight transfer\n"
        "- Follow-through: chicken wing, balanced finish, deceleration\n\n"

        "RULES\n"
        "- Be specific and visual: 'left elbow breaks down at 3 o'clock' not 'arm action could improve'.\n"
        "- If the root cause is upstream, say so: 'The slice is a symptom — the cause is [X]'.\n"
        "- Do not mention a phase unless you have something meaningful to say about it.\n"
        "- Do not soften significant problems with 'slightly' or 'a little'.\n"
        "- Answer in English."
        + (
            f"\n\nFOCUS QUESTION FROM THE STUDENT\n"
            f"The student specifically asks: \"{user_question}\"\n"
            "Address this directly in your findings. If the answer is visible in the video, explain the cause. "
            "If it is not visible from this camera angle, say so."
            if user_question else ""
        )
        + metrics_text
        + _profile_text(profile or {})
    )


def _sync_review(videos: list[tuple[bytes, str, str, str]], user_question: str | None = None,
                 metrics_text: str = "", profile: dict | None = None) -> _AiReview:
    client = genai.Client(api_key=settings.gemini_api_key)

    uploaded = []
    for video_bytes, content_type, *_ in videos:
        f = client.files.upload(
            file=io.BytesIO(video_bytes),
            config=types.UploadFileConfig(mime_type=content_type),
        )
        while f.state and f.state.name == "PROCESSING":
            time.sleep(1)
            f = client.files.get(name=f.name)
        if not f.state or f.state.name != "ACTIVE":
            raise RuntimeError(f"Video upload failed (state: {f.state.name if f.state else 'UNKNOWN'})")
        uploaded.append((f, content_type))

    video_desc = ", ".join(
        f"video {i + 1}: {ANGLE_LABELS.get(angle, angle)}, {handedness}-handed golfer"
        for i, (_, _, angle, handedness) in enumerate(videos)
    )

    view = videos[0][2] if videos else "dtl"
    prompt = _build_prompt(video_desc, view, user_question, metrics_text, profile)

    parts: list = [
        types.Part.from_uri(file_uri=f.uri, mime_type=ct)
        for f, ct in uploaded
    ]
    parts.append(prompt)

    response = client.models.generate_content(
        model=MODEL,
        contents=parts,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=_AiReview,
        ),
    )
    if response.parsed is None:
        raise RuntimeError("Gemini did not return a valid response")
    return response.parsed


async def review_swing(videos: list[tuple[bytes, str, str, str]], user_question: str | None = None, profile: dict | None = None) -> SwingReview:
    now = datetime.now(timezone.utc)

    # Pose-målinger på den analyserte videoen (første). Krever ikke API-nøkkel.
    metrics: list[SwingMetric] = []
    if videos:
        vid_bytes, content_type, view, handedness = videos[0]
        try:
            metrics = await asyncio.to_thread(analyze_pose, vid_bytes, content_type, view, handedness)
        except Exception as e:  # pose-feil skal aldri velte selve reviewen
            print(f"[pose] Målinger feilet: {e}")

    if not settings.gemini_api_key:
        return SwingReview(
            summary="(Placeholder) Solid base swing, but the backswing is a bit fast.",
            phases=[
                SwingPhase(name="Address", note="Good posture and ball position."),
                SwingPhase(name="Takeaway", note="Club moves slightly inside – watch the path."),
                SwingPhase(name="Top", note="Slight overswing – try to stop at parallel."),
                SwingPhase(name="Impact", note="Good weight transfer to lead side."),
                SwingPhase(name="Follow-through", note="Full rotation – well done."),
            ],
            metrics=metrics,
            created_at=now,
        )

    ai = await asyncio.to_thread(_sync_review, videos, user_question, metrics_to_prompt(metrics), profile)
    return SwingReview(
        summary=ai.summary,
        phases=[SwingPhase(name=p.name, note=p.note) for p in ai.phases],
        metrics=metrics,
        created_at=now,
    )
