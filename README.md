# Sword Practice Line Drill

Static, offline-capable web app. Open `index.html` directly or deploy to static hosting.

## Local run

- Double-click `index.html`, or
- Serve the directory:

```bash
python3 -m http.server 8000 --directory .
```

Then open `http://127.0.0.1:8000/`.

## Vercel deployment notes

This repository includes `vercel.json` so Vercel serves static files from this root folder and falls back unknown paths to `index.html`.

If your Vercel URL still shows `Not Found`:

1. Ensure the Vercel project is connected to the `busyrob/swordsman-drills` repo.
2. Ensure the **Root Directory** in Vercel is `/` (repo root).
3. Redeploy after pulling the latest commit containing `vercel.json`.
