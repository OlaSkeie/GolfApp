from datetime import datetime

from pydantic import BaseModel


class SwingReview(BaseModel):
    summary: str       # kort oppsummering fra AI
    feedback: str      # full tilbakemelding
    created_at: datetime
