# PaceParser2

Modern sports telemetry overlay generator — **100% browser-native, zero server**.

Import FIT → Preview → Skin select → Export WebM (green screen for CapCut).

## Quick Start (Linux / Termux)

```bash
# 1. Install Node.js (Termux)
pkg install nodejs python git

# 2. Clone & install
git clone https://github.com/niceescap/PP2.git
cd PP2
npm install

# 3. Dev mode (hot reload, phone-accessible)
npm run dev
# → open http://localhost:5173 on your phone browser

# 4. OR build & serve statically
npm run build
python3 -m http.server 8080 --directory dist
# → open http://localhost:8080
```

## Features

- **FIT binary parser** — reads Garmin/Wahoo/Bryton files directly in browser
- **5 skins** — Cinematic Dark, Glass, Neon Racing, Minimal, Dashboard
- **MAP live** — GPS track overlay on every skin (mercator projection)
- **Chroma key green** — export with `#00ff66` background for CapCut/DS editing
- **Full customization** — colors, fonts, metrics, map position — nothing frozen
- **WebM export** — VP9/VP8 via MediaRecorder, up to 4K

## Skin Previews

| Skin | Vibe | Best For |
|------|------|----------|
| Cinematic Dark | Dark, elegant, film | YouTube, long-form |
| Glass | Translucent, iOS-style | Instagram, modern |
| Neon Racing | Cyberpunk, gaming | TikTok, energetic |
| Minimal | Clean, Apple-like | Professional |
| Dashboard | Dense, data-rich | Analysis, coaching |

## Export Settings

- **Format**: WebM (green) / WebM (transparent) / PNG sequence
- **Resolution**: 1920×1080, 1280×720, 1080×1920 (vertical), 1080×1080
- **FPS**: 1 (light), 24 (cinema), 30 (standard), 60 (smooth)
- **Frequency**: 0.5s → 60s per point

## Tech Stack

- **Vite** — dev server + static build
- **TypeScript** — strict types, zero runtime deps
- **Canvas 2D** — all rendering, no WebGL needed
- **MediaRecorder API** — WebM encoding in-browser

## Roadmap

- [ ] GPX parser
- [ ] Strava API integration
- [ ] Custom skin editor (JSON import/export)
- [ ] Batch export
- [ ] Audio sync marker

---

Built with ❤️ by @lazare_sport · 2026
