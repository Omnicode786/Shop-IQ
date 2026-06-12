# Motion Direction

## Style

The motion style is premium SaaS product-launch motion: calm, smooth, layered, and deliberate. The animation should feel closer to Stripe, Linear, Vercel, Notion, and Apple product films than a normal slideshow.

## Motion System

All shared animation helpers live in:

`src/motion/motionSystem.ts`

The system includes:

- Spring entrances
- Fade plus blur reveal
- Slide reveal
- Staggered reveal
- Premium scale reveal
- Camera zoom
- Parallax movement
- Text clip reveal
- Card stack movement
- Scene transition timing
- Cursor movement
- Highlight pulse

## Easing

The main easing is cubic-bezier based:

- Premium out easing for text and cards
- Soft in-out easing for camera moves and transitions
- Controlled springs for logo and product frame entry

No scene relies on sudden opacity-only changes. Text, cards, screenshots, and workflow lines all move with intention.

## Transitions

Transitions use soft gradient wipes and camera continuity instead of repeated fade cuts. Each transition is subtle enough to keep the video professional, but visible enough to feel directed.

## Visual Hierarchy

The video uses three hierarchy levels:

1. Product name or scene headline
2. One short explanatory line
3. Product screen or animated workflow proof

Text is kept short so the video works without voiceover.

## Color System

The palette follows ShopIQ's real app language:

- ShopIQ orange/red accent
- Deep black/violet app background
- Blue operational accent
- Violet AI accent
- Emerald success/stock accent
- Amber finance/payment accent
- Light mode neutral surfaces

Dark liquid mode is the primary cinematic world. Light mode appears in feature walkthroughs and the polish scene to prove theme flexibility.

## Typography

The video uses system UI typography with heavy weights and tight hierarchy to match the app's existing SaaS/dashboard feel. It avoids decorative type because the product is operational and business-focused.

## Why It Feels Premium

- Real product screenshots are framed as polished product surfaces.
- Scenes have camera movement, parallax, layered depth, and staged reveals.
- Feature scenes have breathing room instead of cramming every module at once.
- Captions are specific to ShopIQ workflows.
- The workflow scene shows record relationships instead of abstract hype.
- The final scene slows down and lets the product identity settle.

