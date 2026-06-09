# Backend (FastAPI)

AI golf swing-review API. Kaller Gemini (i `app/services/gemini.py` – det eneste
stedet som snakker med Gemini). Uten `GEMINI_API_KEY` kjører den i placeholder-modus.

## Kom i gang

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # legg inn GEMINI_API_KEY når du har en
uvicorn app.main:app --reload
```

- API kjører på http://localhost:8000
- Interaktiv dok: http://localhost:8000/docs

## Endepunkter

- `GET /health` – sjekk at serveren lever
- `POST /reviews` – send en swing-video (multipart `video`), få en `SwingReview`
