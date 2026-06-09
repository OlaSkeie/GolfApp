"""Det eneste stedet i backenden som snakker med Gemini.

Akkurat nå returnerer dette en placeholder hvis ingen API-nøkkel er satt,
slik at hele appen kan kjøres ende-til-ende uten nøkkel. Når du er klar:

  1. Skaff en nøkkel: https://aistudio.google.com/apikey
  2. Legg den i backend/.env som GEMINI_API_KEY (se .env.example).
  3. Fyll inn det ekte kallet der det er markert under.
"""

from datetime import datetime, timezone

from app.config import settings
from app.schemas import SwingReview

SWING_PROMPT = (
    "Du er en PGA-golftrener. Analyser golfsvingen i videoen. Gi: "
    "1) en kort oppsummering, 2) tre konkrete forbedringspunkter. Svar på norsk."
)


async def review_swing(video_bytes: bytes, content_type: str) -> SwingReview:
    now = datetime.now(timezone.utc)

    if not settings.gemini_api_key:
        # --- PLACEHOLDER-modus (ingen nøkkel satt) ---
        return SwingReview(
            summary="(Placeholder) Solid grunnsving, men litt for rask bakswing.",
            feedback=(
                "(Placeholder-svar – ikke et ekte AI-svar ennå)\n\n"
                "Her vil den ekte Gemini-tilbakemeldingen vises når GEMINI_API_KEY er satt.\n"
                f'Prompt som vil brukes:\n"{SWING_PROMPT}"'
            ),
            created_at=now,
        )

    # --- EKTE KALL (skisse – fyll inn når du har nøkkel) ---
    # from google import genai
    # client = genai.Client(api_key=settings.gemini_api_key)
    # 1. Last opp video_bytes via client.files (Files API) – større videoer kan
    #    ikke sendes inline.
    # 2. client.models.generate_content(model="gemini-2.x", contents=[SWING_PROMPT, file])
    # 3. Parse svaret til summary + feedback og returner et SwingReview.
    raise NotImplementedError("Ekte Gemini-kall er ikke implementert ennå.")
