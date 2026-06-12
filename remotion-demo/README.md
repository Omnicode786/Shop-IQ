# ShopIQ Remotion Demo

This folder contains the Remotion SaaS product demo for ShopIQ.

## Install

```bash
npm install
```

## Capture Product Screenshots

The project includes a Playwright screenshot script that captures the real ShopIQ app.

```bash
SHOPIQ_CAPTURE_URL=http://localhost:3001 npm run capture
```

For light mode:

```bash
SHOPIQ_CAPTURE_URL=http://localhost:3001 SHOPIQ_CAPTURE_DIR=screenshots-light SHOPIQ_CAPTURE_THEME=light SHOPIQ_CAPTURE_UI_MODE=classic npm run capture
```

On Windows PowerShell:

```powershell
$env:SHOPIQ_CAPTURE_URL='http://localhost:3001'
$env:SHOPIQ_CAPTURE_DIR='screenshots-light'
$env:SHOPIQ_CAPTURE_THEME='light'
$env:SHOPIQ_CAPTURE_UI_MODE='classic'
npm run capture
```

## Preview

```bash
npm run preview
```

## Render

```bash
npm run render
```

Output:

```text
out/saas-demo.mp4
```

## Composition

- Composition name: `SaaSDemo`
- Resolution: `1920x1080`
- FPS: `60`
- Duration: `160 seconds`

## Troubleshooting

- If screenshots are stale, re-run the capture script while the ShopIQ dev server is running.
- If Playwright cannot open Chromium, run `npx playwright install chromium`.
- If Remotion cannot find assets, confirm the screenshots exist inside `public/screenshots` and `public/screenshots-light`.
- If the render feels slow, keep the composition at 60fps and reduce open browser tabs/background apps instead of lowering the video quality.

