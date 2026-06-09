# Golf Swing AI

iOS-app der du får AI-tilbakemelding (Gemini) på golfsvingen din.

Monorepo:

- `mobile/` – appen (React Native + Expo + TypeScript)
- `backend/` – API-et (Python + FastAPI) som kaller Gemini

## Kom i gang

Start backend (se `backend/README.md`):

```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Start appen i et annet terminalvindu:

```bash
cd mobile && cp .env.example .env && npm install && npx expo start
```

Uten `GEMINI_API_KEY` kjører backenden i placeholder-modus, så hele flyten
(hjem → record → review) virker uten nøkkel.
