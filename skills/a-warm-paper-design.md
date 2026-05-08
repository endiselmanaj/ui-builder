---
version: alpha
name: Warm Paper
description: Warm, earthy "paper-tone" design system — parchment background (#f5efe6), moss green and mahogany brown accents, soft rounded containers (2rem), glass-paper depth via gradients and borders instead of shadows, Inter typography, and WebGL floating octahedrons. Conveys trust, warmth, and organic professionalism. Use this as the visual foundation and expand it into a full application for whatever the user's prompt describes.
---

# Warm Paper Design System

Build a complete, production-quality web application using the Warm Paper design language as the visual foundation. The user's prompt describes *what* to build — this skill describes *how it should look and feel*.

You are not recreating the MentorBridge page. You are using its design DNA — earthy palette, paper-tone surfaces, soft geometry, stratified glass depth, and organic warmth — to build whatever the user asks for. Every screen, component, and interaction you create should feel like it belongs in the same product family.

## Visual Identity

The aesthetic is **"warm professionalism"** — a boutique, organic feel that combines earthy tones with structured, deliberate layout. Think high-end stationery, not corporate SaaS. Depth comes from layered paper-like gradients and fine borders, never from drop shadows.

## Color Palette

| Token | Value | Role |
|---|---|---|
| background | `#f5efe6` | Primary page surface. Paper-toned warm white. Applied via radial gradient: `radial-gradient(circle at top, rgba(237,228,214,0.9) 0%, rgba(245,239,230,1) 42%, rgba(241,234,223,1) 100%)` |
| surface-light | `#fbf6f0` / `#fcf8f1` | Slightly lighter card surfaces — use variation to create depth between nested containers |
| text-primary | `#1f1b16` | Near-black warm brown. All headings and primary text. Never use pure `#000000` |
| text-secondary | `#5c5145` / `#61564a` | Medium warm brown. Body copy, descriptions |
| text-muted | `#7e7365` / `#847666` | Light brown-grey. Labels, metadata, captions |
| moss-green | `#2e3a2f` | Deep moss. Primary button gradient start, dark accent |
| mahogany | `#5c3822` | Rich brown. Primary button gradient end, warm accent |
| border | `#d8cebe` / `#d7cbbb` / `#ddd2c2` | Warm tan. All borders — cards, inputs, dividers. Vary slightly for hierarchy |
| highlight | `rgba(255,255,255,0.48)` | White overlay for glass-paper surfaces on badges and chips |
| selection | `bg-[#d7c2ab] text-[#1f1b16]` | Text selection colors |

**Brand gradient** (for primary buttons and dark accent sections):
```css
background: linear-gradient(135deg, #2e3a2f 0%, #5c3822 100%);
```
Text on this gradient uses `#f8f4ed` (warm cream white), with secondary text at `#eaded2`.

## Typography

**Font stack**: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif.

| Role | Size | Weight | Tracking | Line Height | Notes |
|---|---|---|---|---|---|
| Display / Hero h1 | `text-4xl` → `text-6xl` responsive | `font-semibold` (600) | `tracking-tight` | tight (1.1–1.15) | Use for main page headlines |
| Section h2 | `text-3xl` → `text-4xl` responsive | `font-semibold` (600) | `tracking-tight` | tight | Section headers |
| Card h3 | `text-lg` | `font-medium` (500) | `tracking-tight` | normal | Card and component titles |
| Body | `text-sm` / `text-base` | `font-normal` (400) | default | `leading-7` (1.75) | Generous line-height for comfort |
| Label / Section tag | `text-xs` | `font-medium` (500) | `tracking-[0.18em]` + `uppercase` | normal | Category labels above sections: e.g. "How it works", "FAQ" — always uppercase with wide letter-spacing |
| Stat number | `text-xl` / `text-2xl` | `font-semibold` (600) | `tracking-tight` | normal | Metric counters inside stat cards |

## Shapes & Corner Radius

The shape language is soft and organic — generous rounding, never sharp corners:

| Element | Radius | Notes |
|---|---|---|
| Major containers / hero blocks | `rounded-[2rem]` | The signature large radius |
| Section cards / article blocks | `rounded-[1.75rem]` | Slightly tighter for secondary containers |
| Inner cards / nested blocks | `rounded-[1.5rem]` / `rounded-[1.25rem]` | Progressively tighter as nesting increases |
| Stat boxes, small cards | `rounded-2xl` | Standard Tailwind large radius |
| Icon containers | `rounded-2xl` | 48×48px icon boxes |
| Buttons, pills, badges, chips | `rounded-full` | All interactive pills are fully round |
| Avatars | `rounded-2xl` | Not circular — soft-squared |

**Key rule**: avoid sharp 90-degree corners anywhere. The system favors "squircle-like" rounding throughout.

## Elevation & Depth — "Stratified Glass-Paper"

Depth is never created with `box-shadow` drop shadows. Instead, use these layered techniques:

**Card surface recipe** — gradient backgrounds simulating light hitting paper:
```css
background: linear-gradient(180deg, rgba(251,247,240,0.9) 0%, rgba(245,239,230,0.88) 100%);
```
Combined with a `border border-[#d9cfbf]` to define edges.

**Hero / major container** — add an inset highlight for tactile depth:
```css
background: linear-gradient(180deg, rgba(250,246,239,0.92) 0%, rgba(245,239,230,0.86) 100%);
box-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 1px 0 rgba(114,93,72,0.04);
```

**Glass-paper badges/chips** — semi-transparent white with border:
```css
background: rgba(255,255,255,0.48);
```
with `border border-[#dbcfbf]`.

**Sticky header** — backdrop blur over the paper background:
```css
background: rgba(245,239,230,0.78);
backdrop-filter: blur(24px);  /* backdrop-blur-xl */
border-bottom: 1px solid rgba(221,210,194,0.8);
```

**Gradient border overlays** — for premium card edges, use a pseudo-element with mask-composite:
```css
background: linear-gradient(135deg, rgba(255,255,255,0.72), rgba(173,150,127,0.34), rgba(255,255,255,0.52));
-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
-webkit-mask-composite: xor;
mask-composite: exclude;
```

## Layout

- **Centered canvas**: `max-w-7xl mx-auto` with responsive padding (`px-4 sm:px-6 lg:px-8`).
- **Vertical guide rails** (desktop only): fixed 1px vertical lines at left/right edges of the max-width container with small diamond decorations at corners — creates an architectural framing effect. Implement with a fixed `div` containing absolute-positioned border lines.
- **Section rhythm**: generous vertical padding (`py-12 sm:py-16 lg:py-20`) between sections.
- **Card padding**: `p-6` standard, `p-4 sm:p-6 lg:p-8` for hero containers.
- **Grid patterns**: 3-column for feature cards, 2-column asymmetric (`grid-cols-[1fr_1.15fr]`) for content + sidebar layouts, 2-column for stat pairs.

## Icons

Use **Iconify** with the **Solar** icon set (linear style). Load via:
```html
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
```
Usage: `<iconify-icon icon="solar:icon-name-linear" width="22" height="22" style="color:#5c3822;" data-inline="false"></iconify-icon>`

Icon containers: 48×48px (`h-12 w-12`), `rounded-2xl`, `border border-[#d7cbbb]`, `background: rgba(255,255,255,0.64)`. Icon colors alternate between moss green `#2e3a2f` and mahogany `#5c3822`.

## Button Hierarchy

**Primary button** — moss-to-mahogany gradient, fully rounded, cream-white text:
```html
<a class="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-[#f8f4ed]"
   style="background: linear-gradient(135deg, #2e3a2f 0%, #5c3822 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);">
```

**Secondary button** — light gradient fill, warm border, dark text:
```html
<a class="inline-flex items-center justify-center gap-2 rounded-full border border-[#d7cbbb] px-5 py-3 text-sm font-medium text-[#1f1b16]"
   style="background: linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(244,236,225,0.94) 100%);">
```

**Inverted button** (on dark gradient sections) — light warm background:
```html
<a class="inline-flex items-center justify-center gap-2 rounded-full bg-[#f6efe5] px-5 py-3 text-sm font-medium text-[#1f1b16]">
```

## Components to Reuse

**Section label** — always precedes a heading:
```html
<div class="text-xs font-medium uppercase tracking-[0.18em] text-[#847666]">Section name</div>
```

**Stat card**:
```html
<div class="rounded-2xl border border-[#ddd2c2] p-4" style="background: rgba(255,255,255,0.46);">
  <div class="text-xl font-semibold tracking-tight text-[#1f1b16]">200+</div>
  <div class="mt-1 text-xs text-[#6b6054]">description</div>
</div>
```

**Pill badge** — status indicators, category tags:
```html
<span class="rounded-full border border-[#ddd2c2] px-3 py-1.5 text-xs text-[#5e5347]">Label</span>
```

**Dark accent card** — one per grid row, for visual contrast:
```html
<div class="rounded-[1.75rem] border border-[#d8cebe] p-6 text-[#f8f4ed]"
     style="background: linear-gradient(135deg, #2e3a2f 0%, #5c3822 100%);">
```

**FAQ accordion** — uses `<details>` with `group-open:rotate-45` on the `+` icon:
```html
<details class="group rounded-[1.5rem] border border-[#d8cebe] p-5" style="background: rgba(251,247,240,0.86);">
  <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-[#1f1b16]">
    Question text
    <span class="flex h-8 w-8 items-center justify-center rounded-full border border-[#ddd2c2] text-[#6f6458] transition group-open:rotate-45" style="background: rgba(255,255,255,0.56);">+</span>
  </summary>
  <p class="mt-4 text-sm leading-7 text-[#61564a]">Answer text</p>
</details>
```

## Motion & Animation

**Word-by-word headline reveal** — GSAP-powered. Elements with class `reveal` have their text split into individually animated words. Each word translates from `y: 115%` to `0` with `power3.out` easing, 0.9s duration, 0.045s stagger, triggered by ScrollTrigger at `top 82%`. Apply to all section `<h2>` elements and the hero `<h1>`.

**Smooth scroll**: Set `scroll-behavior: smooth` on the body.

**Hover effects**: Subtle color shifts and opacity transitions only. No aggressive scale-ups or physical movement — the aesthetic is calm and unhurried.

Include GSAP + ScrollTrigger:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
```

## WebGL Background

A fixed full-viewport canvas behind all content at low opacity (`opacity-40`), rendering procedural floating **sdOctahedron** primitives with a sepia-toned earthy color palette (brown `(0.36, 0.22, 0.13)`, moss `(0.18, 0.23, 0.18)`, warm `(0.69, 0.56, 0.44)`). The scene uses noise-based drift, slow rotation, and a vignette effect. Include this for landing/hero pages. For interior app pages (dashboards, forms, lists), skip the WebGL — the paper-tone background and card layering carry the design on their own.

## Expanding the Design System

When the user's prompt requires components not covered above:

- **Inputs**: `rounded-full` or `rounded-2xl`, `border border-[#d8cebe]`, background `rgba(255,255,255,0.6)`, focus ring in `#5c3822` (mahogany). Height 44–48px.
- **Tables / data displays**: Clean lines, `text-sm`, `border-b border-[#ddd2c2]` row separators on the paper background. No zebra striping — use the background gradient to define rows.
- **Navigation / sidebars**: Sticky header with `backdrop-blur-xl` and semi-transparent paper background. Nav links in `text-[#5c5145]`, hover to `text-[#1f1b16]`.
- **Modals / dialogs**: `rounded-[2rem]`, paper-gradient background, warm border, gradient border overlay for premium feel.
- **Progress bars**: `rounded-full`, track in `#ece2d3`, fill with the moss-to-mahogany gradient (`linear-gradient(90deg, #8a5a37 0%, #2e3a2f 100%)`).
- **Toggles / switches**: `rounded-full`, warm border, moss-green active state.
- **Dark accent bands**: Use the moss-to-mahogany gradient for CTA sections or call-out blocks. One per page is ideal — not every other section.
- **Avatar images**: `rounded-2xl` (soft-squared, not circular), `object-cover`.

## Guardrails

- Do not use pure black (`#000`) or pure white (`#fff`) for text or backgrounds. The palette is warm — use the specific tokens above.
- Do not use drop shadows for elevation. Depth comes from layered gradients, borders, and inset highlights.
- Do not use sharp corners. Every container uses generous rounding (`rounded-2xl` minimum).
- Do not flatten the design into a generic Tailwind template. The paper-tone surface, warm borders, and stratified glass-paper depth are the defining elements.
- Do not overuse the dark moss-to-mahogany gradient — it's for primary CTAs and one accent section per page, not for every card.
- Use real, descriptive placeholder content — no lorem ipsum, no foo/bar.
- Keep the uppercase tracked section labels (`tracking-[0.18em]`) as a consistent pattern above every major heading.
- Every page should feel like part of the Warm Paper product family even if the content is completely different from the original mentorship theme.

## Reference HTML

The HTML below is the canonical source of truth for this design system. Study it for exact class names, inline styles, gradient recipes, border values, WebGL shader code, and animation setup. When in doubt about how to implement a pattern, refer back to this HTML.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MentorBridge — Find a mentor to help you grow your career</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
</head>
<body class="bg-[#f5efe6] text-[#1f1b16] antialiased selection:bg-[#d7c2ab] selection:text-[#1f1b16]" style="font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; scroll-behavior: smooth; background: radial-gradient(circle at top, rgba(237,228,214,0.9) 0%, rgba(245,239,230,1) 42%, rgba(241,234,223,1) 100%);">
  <canvas id="bg-canvas" class="fixed top-0 left-0 w-screen h-screen -z-10 pointer-events-none opacity-40"></canvas>

  <!-- Vertical guide rails (desktop only) -->
  <div class="fixed inset-y-0 left-1/2 hidden w-full max-w-7xl -translate-x-1/2 lg:block pointer-events-none">
    <div class="absolute inset-y-0 left-0 w-px bg-[#d8cebf]"></div>
    <div class="absolute inset-y-0 right-0 w-px bg-[#d8cebf]"></div>
    <div class="absolute left-0 top-24 h-2 w-2 -translate-x-1/2 rounded-sm border border-[#c9bcaa] bg-[#f8f3eb]"></div>
    <div class="absolute right-0 top-24 h-2 w-2 translate-x-1/2 rounded-sm border border-[#c9bcaa] bg-[#f8f3eb]"></div>
    <div class="absolute left-0 bottom-24 h-2 w-2 -translate-x-1/2 rounded-sm border border-[#c9bcaa] bg-[#f8f3eb]"></div>
    <div class="absolute right-0 bottom-24 h-2 w-2 translate-x-1/2 rounded-sm border border-[#c9bcaa] bg-[#f8f3eb]"></div>
  </div>

  <header class="sticky top-0 z-40 border-b border-[#ddd2c2]/80 backdrop-blur-xl" style="background: rgba(245,239,230,0.78);">
    <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
      <a href="#top" class="flex items-center gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d7cbbb]" style="background: linear-gradient(180deg, #f9f4ec 0%, #efe5d7 100%);">
          <span class="relative h-5 w-5">
            <span class="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#2f3a2f]"></span>
            <span class="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#8a5a37]"></span>
            <span class="absolute left-1.5 top-2 h-2 w-2 rounded-full bg-[#c59a71]"></span>
            <span class="absolute left-1.5 top-[0.45rem] h-px w-2.5 rotate-[24deg] bg-[#6e7a67]"></span>
            <span class="absolute left-1.5 top-[0.55rem] h-px w-2.5 rotate-[-22deg] bg-[#6e7a67]"></span>
          </span>
        </span>
        <div>
          <div class="text-sm font-medium tracking-tight text-[#1f1b16]">MentorBridge</div>
          <div class="text-xs text-[#7e7365]">Central Asia mentorship marketplace</div>
        </div>
      </a>
      <nav class="hidden items-center gap-8 md:flex">
        <a href="#how" class="text-sm font-normal text-[#5c5145] transition hover:text-[#1f1b16]">How it works</a>
        <a href="#why" class="text-sm font-normal text-[#5c5145] transition hover:text-[#1f1b16]">Why us</a>
        <a href="#categories" class="text-sm font-normal text-[#5c5145] transition hover:text-[#1f1b16]">Categories</a>
        <a href="#testimonials" class="text-sm font-normal text-[#5c5145] transition hover:text-[#1f1b16]">Stories</a>
        <a href="#faq" class="text-sm font-normal text-[#5c5145] transition hover:text-[#1f1b16]">FAQ</a>
      </nav>
      <div class="flex items-center gap-3">
        <a href="#mentor-cta" class="hidden rounded-full border border-[#d7cbbb] px-4 py-2 text-sm font-medium text-[#1f1b16] md:inline-flex" style="background: linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(244,236,225,0.8) 100%);">Become a mentor</a>
        <a href="#hero-cta" class="inline-flex rounded-full px-4 py-2 text-sm font-medium text-[#f8f4ed]" style="background: linear-gradient(135deg, #2e3a2f 0%, #5c3822 100%);">Find a mentor</a>
      </div>
    </div>
  </header>

  <main id="top">
    <section class="relative overflow-hidden">
      <div class="mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24 lg:pb-20">
        <div class="rounded-[2rem] border border-[#d9cfbf] p-4 sm:p-6 lg:p-8" style="background: linear-gradient(180deg, rgba(250,246,239,0.92) 0%, rgba(245,239,230,0.86) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 1px 0 rgba(114,93,72,0.04);">
          <div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div class="max-w-2xl">
              <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dbcfbf] px-3 py-1.5 text-xs font-medium text-[#665a4d]" style="background: rgba(255,255,255,0.48);">
                <span class="h-1.5 w-1.5 rounded-full bg-[#7a916d]"></span>
                Built for real people across Central Asia
              </div>
              <h1 class="reveal text-4xl font-semibold leading-tight tracking-tight text-[#1b1713] sm:text-5xl lg:text-6xl">
                Find a mentor to help you grow your career
              </h1>
              <p class="mt-5 max-w-xl text-base font-normal leading-7 text-[#5c5145] sm:text-lg">
                Hands-on learning from IT, design, business, and marketing professionals in Central Asia.
              </p>
              <div id="hero-cta" class="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#categories" class="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-[#f8f4ed]" style="background: linear-gradient(135deg, #2e3a2f 0%, #5c3822 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.14);">
                  <iconify-icon icon="solar:users-group-rounded-linear" width="18" height="18" style="color:#f8f4ed;" data-inline="false"></iconify-icon>
                  Find a mentor
                </a>
                <a href="#mentor-cta" class="inline-flex items-center justify-center gap-2 rounded-full border border-[#d7cbbb] px-5 py-3 text-sm font-medium text-[#1f1b16]" style="background: linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(244,236,225,0.94) 100%);">
                  <iconify-icon icon="solar:hand-money-linear" width="18" height="18" style="color:#1f1b16;" data-inline="false"></iconify-icon>
                  Become a mentor
                </a>
              </div>
              <div class="mt-8 grid max-w-lg grid-cols-3 gap-3">
                <div class="rounded-2xl border border-[#ddd2c2] p-4" style="background: rgba(255,255,255,0.46);">
                  <div class="text-xl font-semibold tracking-tight text-[#1f1b16]">200+</div>
                  <div class="mt-1 text-xs text-[#6b6054]">trusted mentors</div>
                </div>
                <div class="rounded-2xl border border-[#ddd2c2] p-4" style="background: rgba(255,255,255,0.46);">
                  <div class="text-xl font-semibold tracking-tight text-[#1f1b16]">1500+</div>
                  <div class="mt-1 text-xs text-[#6b6054]">successful sessions</div>
                </div>
                <div class="rounded-2xl border border-[#ddd2c2] p-4" style="background: rgba(255,255,255,0.46);">
                  <div class="text-xl font-semibold tracking-tight text-[#1f1b16]">6</div>
                  <div class="mt-1 text-xs text-[#6b6054]">career categories</div>
                </div>
              </div>
            </div>
            <div class="relative">
              <div class="absolute -left-4 -top-4 h-24 w-24 rounded-full blur-3xl" style="background: rgba(196,161,123,0.18);"></div>
              <div class="absolute -bottom-4 -right-4 h-24 w-24 rounded-full blur-3xl" style="background: rgba(69,89,70,0.16);"></div>
              <div class="relative rounded-[2rem] border border-[#d6cab9] p-3" style="background: linear-gradient(180deg, rgba(255,255,255,0.58) 0%, rgba(241,233,221,0.9) 100%);">
                <div class="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <div class="overflow-hidden rounded-[1.5rem] border border-[#d6cab9]">
                    <img src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/3186f9ea-5f5a-49f7-8fcf-568ad52f515e_3840w.webp" alt="Mentor and mentee in conversation" class="h-full w-full object-cover" style="aspect-ratio: 4 / 5;" />
                  </div>
                  <div class="flex flex-col gap-3">
                    <div class="rounded-[1.25rem] border border-[#d9cebe] p-4" style="background: rgba(249,244,236,0.92);">
                      <div class="flex items-center justify-between">
                        <div>
                          <div class="text-xs text-[#7b6f61]">Next step</div>
                          <div class="mt-1 text-sm font-medium text-[#1f1b16]">Book your first 1:1 session</div>
                        </div>
                        <span class="rounded-full px-2.5 py-1 text-xs font-medium text-[#2e3a2f]" style="background: rgba(109,130,108,0.12);">Live</span>
                      </div>
                      <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#ece2d3]">
                        <div class="h-full rounded-full" style="width: 72%; background: linear-gradient(90deg, #8a5a37 0%, #2e3a2f 100%);"></div>
                      </div>
                    </div>
                    <div class="rounded-[1.25rem] border border-[#d9cebe] p-4" style="background: rgba(252,248,241,0.94);">
                      <div class="flex items-center gap-3">
                        <img src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/eca707cc-a5b7-439a-b4fd-247f6106c2e1_1600w.jpg" alt="Mentor avatar" class="h-12 w-12 rounded-2xl object-cover" />
                        <div>
                          <div class="text-sm font-medium text-[#1f1b16]">Aida S.</div>
                          <div class="text-xs text-[#6f6356]">Product Designer · 7 years</div>
                        </div>
                      </div>
                      <div class="mt-4 grid grid-cols-2 gap-2 text-xs text-[#62574b]">
                        <div class="rounded-xl border border-[#e1d7c8] p-3">RU / EN / KZ</div>
                        <div class="rounded-xl border border-[#e1d7c8] p-3">$18 / session</div>
                      </div>
                    </div>
                    <div class="rounded-[1.25rem] border border-[#3f342b]/10 p-4 text-[#f8f4ed]" style="background: linear-gradient(135deg, #2e3a2f 0%, #5c3822 100%);">
                      <div class="text-xs text-[#e8dacb]">Warm, practical guidance</div>
                      <div class="mt-2 text-sm font-medium">Learn from people who understand your local context, language, and career path.</div>
                    </div>
                  </div>
                </div>
                <div class="pointer-events-none absolute inset-0 rounded-[2rem]" style="padding: 1px; background: linear-gradient(135deg, rgba(255,255,255,0.72), rgba(173,150,127,0.34), rgba(255,255,255,0.52)); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="how" class="py-12 sm:py-16 lg:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mb-10 max-w-2xl">
          <div class="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[#847666]">How it works</div>
          <h2 class="reveal text-3xl font-semibold tracking-tight text-[#1d1914] sm:text-4xl">Simple steps from curiosity to confidence</h2>
          <p class="mt-4 text-sm leading-7 text-[#61564a] sm:text-base">A calm, transparent path that makes mentorship feel easy from the very first click.</p>
        </div>
        <div class="grid gap-4 md:grid-cols-3">
          <article class="rounded-[1.75rem] border border-[#d9cfbf] p-6" style="background: linear-gradient(180deg, rgba(251,247,240,0.9) 0%, rgba(245,239,230,0.88) 100%);">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d7cbbb]" style="background: rgba(255,255,255,0.64);">
              <iconify-icon icon="solar:widget-add-linear" width="22" height="22" style="color:#5c3822;" data-inline="false"></iconify-icon>
            </div>
            <div class="mt-5 flex items-center gap-2">
              <span class="rounded-full border border-[#d9cfbf] px-2.5 py-1 text-xs text-[#6b6054]">Step 1</span>
            </div>
            <h3 class="mt-4 text-lg font-medium tracking-tight text-[#1f1b16]">Choose a field</h3>
            <p class="mt-2 text-sm leading-7 text-[#62574b]">Pick UX/UI, programming, marketing, business, English, or career growth based on what you want to improve right now.</p>
          </article>
          <article class="rounded-[1.75rem] border border-[#d9cfbf] p-6" style="background: linear-gradient(180deg, rgba(251,247,240,0.9) 0%, rgba(245,239,230,0.88) 100%);">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d7cbbb]" style="background: rgba(255,255,255,0.64);">
              <iconify-icon icon="solar:tuning-2-linear" width="22" height="22" style="color:#2e3a2f;" data-inline="false"></iconify-icon>
            </div>
            <div class="mt-5 flex items-center gap-2">
              <span class="rounded-full border border-[#d9cfbf] px-2.5 py-1 text-xs text-[#6b6054]">Step 2</span>
            </div>
            <h3 class="mt-4 text-lg font-medium tracking-tight text-[#1f1b16]">Find a mentor with filters</h3>
            <p class="mt-2 text-sm leading-7 text-[#62574b]">Compare mentors by experience, language, and price so the choice feels clear, human, and relevant to your goals.</p>
          </article>
          <article class="rounded-[1.75rem] border border-[#d9cfbf] p-6" style="background: linear-gradient(180deg, rgba(251,247,240,0.9) 0%, rgba(245,239,230,0.88) 100%);">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d7cbbb]" style="background: rgba(255,255,255,0.64);">
              <iconify-icon icon="solar:chat-round-line-linear" width="22" height="22" style="color:#5c3822;" data-inline="false"></iconify-icon>
            </div>
            <div class="mt-5 flex items-center gap-2">
              <span class="rounded-full border border-[#d9cfbf] px-2.5 py-1 text-xs text-[#6b6054]">Step 3</span>
            </div>
            <h3 class="mt-4 text-lg font-medium tracking-tight text-[#1f1b16]">Start learning in 1:1 sessions</h3>
            <p class="mt-2 text-sm leading-7 text-[#62574b]">Get direct, practical help online—whether you need one consultation or ongoing mentorship across several weeks.</p>
          </article>
        </div>
      </div>
    </section>

    <section id="why" class="py-12 sm:py-16 lg:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
          <div class="rounded-[2rem] border border-[#d8cebe] p-6 sm:p-8" style="background: linear-gradient(180deg, rgba(250,246,239,0.94) 0%, rgba(244,237,226,0.92) 100%);">
            <div class="text-xs font-medium uppercase tracking-[0.18em] text-[#847666]">Why MentorBridge</div>
            <h2 class="reveal mt-3 text-3xl font-semibold tracking-tight text-[#1d1914] sm:text-4xl">A mentorship experience that feels local, trusted, and easy to start</h2>
            <p class="mt-4 text-sm leading-7 text-[#61564a] sm:text-base">We believe real growth happens through personal connection.</p>
            <div class="mt-8 grid grid-cols-2 gap-3">
              <div class="rounded-2xl border border-[#ddd2c2] p-4" style="background: rgba(255,255,255,0.4);">
                <div class="text-2xl font-semibold tracking-tight text-[#1f1b16]">200+</div>
                <div class="mt-1 text-xs text-[#6b6054]">mentors across key industries</div>
              </div>
              <div class="rounded-2xl border border-[#ddd2c2] p-4" style="background: rgba(255,255,255,0.4);">
                <div class="text-2xl font-semibold tracking-tight text-[#1f1b16]">1500+</div>
                <div class="mt-1 text-xs text-[#6b6054]">sessions that moved careers forward</div>
              </div>
            </div>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="rounded-[1.75rem] border border-[#d8cebe] p-6" style="background: rgba(252,248,241,0.86);">
              <iconify-icon icon="solar:shield-check-linear" width="22" height="22" style="color:#2e3a2f;" data-inline="false"></iconify-icon>
              <h3 class="mt-4 text-lg font-medium tracking-tight text-[#1f1b16]">Vetted mentors</h3>
              <p class="mt-2 text-sm leading-7 text-[#62574b]">Real-world professionals with practical experience, not only theory.</p>
            </div>
            <div class="rounded-[1.75rem] border border-[#d8cebe] p-6" style="background: rgba(252,248,241,0.86);">
              <iconify-icon icon="solar:global-linear" width="22" height="22" style="color:#5c3822;" data-inline="false"></iconify-icon>
              <h3 class="mt-4 text-lg font-medium tracking-tight text-[#1f1b16]">Locally relevant</h3>
              <p class="mt-2 text-sm leading-7 text-[#62574b]">Professionals who understand local culture, language, and opportunities.</p>
            </div>
            <div class="rounded-[1.75rem] border border-[#d8cebe] p-6" style="background: rgba(252,248,241,0.86);">
              <iconify-icon icon="solar:clock-circle-linear" width="22" height="22" style="color:#2e3a2f;" data-inline="false"></iconify-icon>
              <h3 class="mt-4 text-lg font-medium tracking-tight text-[#1f1b16]">Flexible formats</h3>
              <p class="mt-2 text-sm leading-7 text-[#62574b]">Book a single consultation or build a longer mentorship relationship.</p>
            </div>
            <div class="rounded-[1.75rem] border border-[#d8cebe] p-6 text-[#f8f4ed]" style="background: linear-gradient(135deg, #2e3a2f 0%, #5c3822 100%);">
              <iconify-icon icon="solar:heart-angle-linear" width="22" height="22" style="color:#f3e7d9;" data-inline="false"></iconify-icon>
              <h3 class="mt-4 text-lg font-medium tracking-tight">Human by design</h3>
              <p class="mt-2 text-sm leading-7 text-[#eadfd0]">Warm, supportive guidance with transparent pricing and a sense of community.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="mentor-cta" class="py-12 sm:py-16 lg:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="rounded-[2rem] border border-[#d8cebe] p-6 sm:p-8 lg:p-10" style="background: linear-gradient(135deg, rgba(46,58,47,0.98) 0%, rgba(92,56,34,0.98) 100%);">
          <div class="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div class="max-w-2xl">
              <div class="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-[#e7d9ca]">
                <span class="h-1.5 w-1.5 rounded-full bg-[#c7a27a]"></span>
                For experienced specialists
              </div>
              <h2 class="reveal mt-4 text-3xl font-semibold tracking-tight text-[#fbf6f0] sm:text-4xl">Share your experience. Monetize your knowledge.</h2>
              <p class="mt-4 max-w-xl text-sm leading-7 text-[#eaded2] sm:text-base">A thoughtful way to support students and early-career talent while earning through consultations.</p>
            </div>
            <div>
              <a href="#footer" class="inline-flex items-center justify-center gap-2 rounded-full bg-[#f6efe5] px-5 py-3 text-sm font-medium text-[#1f1b16]">
                <iconify-icon icon="solar:user-plus-linear" width="18" height="18" style="color:#1f1b16;" data-inline="false"></iconify-icon>
                Become a mentor
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="faq" class="py-12 sm:py-16 lg:py-20">
      <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div class="mb-10 text-center">
          <div class="text-xs font-medium uppercase tracking-[0.18em] text-[#847666]">FAQ</div>
          <h2 class="reveal mt-3 text-3xl font-semibold tracking-tight text-[#1d1914] sm:text-4xl">Questions people usually ask before they start</h2>
        </div>
        <div class="space-y-3">
          <details class="group rounded-[1.5rem] border border-[#d8cebe] p-5" style="background: rgba(251,247,240,0.86);">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-[#1f1b16]">
              How do sessions work?
              <span class="flex h-8 w-8 items-center justify-center rounded-full border border-[#ddd2c2] text-[#6f6458] transition group-open:rotate-45" style="background: rgba(255,255,255,0.56);">+</span>
            </summary>
            <p class="mt-4 text-sm leading-7 text-[#61564a]">You choose a mentor, book a time, and meet online for a 1:1 session focused on your goals, questions, or portfolio.</p>
          </details>
          <details class="group rounded-[1.5rem] border border-[#d8cebe] p-5" style="background: rgba(251,247,240,0.86);">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-[#1f1b16]">
              How much does it cost?
              <span class="flex h-8 w-8 items-center justify-center rounded-full border border-[#ddd2c2] text-[#6f6458] transition group-open:rotate-45" style="background: rgba(255,255,255,0.56);">+</span>
            </summary>
            <p class="mt-4 text-sm leading-7 text-[#61564a]">Prices vary by mentor, experience, and session format. You can compare profiles and choose an option that fits your budget.</p>
          </details>
        </div>
      </div>
    </section>
  </main>

  <footer id="footer" class="border-t border-[#ddd2c2] py-10">
    <div class="mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col gap-4 border-t border-[#ddd2c2] pt-6 text-xs text-[#7a6f62] sm:flex-row sm:items-center sm:justify-between">
        <div>© 2026 MentorBridge. Built for meaningful career growth.</div>
        <div class="flex flex-wrap gap-4">
          <a href="#" class="hover:text-[#1f1b16]">Privacy</a>
          <a href="#" class="hover:text-[#1f1b16]">Terms</a>
          <a href="#" class="hover:text-[#1f1b16]">Support</a>
        </div>
      </div>
    </div>
  </footer>

  <script>
    (function () {
      const reveals = document.querySelectorAll('.reveal');
      reveals.forEach((el) => {
        const text = el.textContent.trim().split(' ');
        el.innerHTML = text.map((word) => {
          return '<span style="display:inline-block; overflow:hidden; vertical-align:top; margin-right:0.28em;"><span class="reveal-word" style="display:inline-block; transform:translateY(115%); opacity:0;">' + word + '</span></span>';
        }).join('');
      });
      gsap.registerPlugin(ScrollTrigger);
      document.querySelectorAll('.reveal').forEach((el) => {
        gsap.to(el.querySelectorAll('.reveal-word'), {
          y: 0, opacity: 1, ease: 'power3.out', duration: 0.9, stagger: 0.045,
          scrollTrigger: { trigger: el, start: 'top 82%', once: true }
        });
      });
    })();

    (function () {
      const canvas = document.getElementById('bg-canvas');
      const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
      if (!gl) return;
      const vertexSrc = `attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
      const fragmentSrc = `
        precision highp float;
        uniform float u_time; uniform vec2 u_resolution;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
        float noise(vec2 p){
          vec2 i=floor(p),f=fract(p);
          float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
          vec2 u=f*f*(3.0-2.0*f);
          return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
        }
        mat2 rot(float a){ float s=sin(a),c=cos(a); return mat2(c,-s,s,c); }
        float sdOctahedron(vec3 p,float s){ p=abs(p); return (p.x+p.y+p.z-s)*0.57735027; }
        float map(vec3 p){
          vec3 q=p;
          q.xy*=rot(0.35+sin(u_time*0.09)*0.2); q.xz*=rot(-0.2+cos(u_time*0.07)*0.16);
          float d1=sdOctahedron(q-vec3(0,0.1*sin(u_time*0.25),3.6),0.95);
          float d2=sdOctahedron((q-vec3(1.35,-0.25,5.1))*vec3(0.85,1.25,0.85),0.82);
          float d3=sdOctahedron((q-vec3(-1.45,0.35,4.6))*vec3(1.15,0.8,1.05),0.76);
          return min(min(d1,d2),d3)+(noise(q.xy*1.2+u_time*0.05)-0.5)*0.18;
        }
        vec3 hueRotateSepia(vec3 c){ mat3 s=mat3(0.393,0.769,0.189,0.349,0.686,0.168,0.272,0.534,0.131); return mix(c,c*s,0.34); }
        vec3 palette(float t){
          vec3 brown=vec3(0.3608,0.2196,0.1333),moss=vec3(0.1804,0.2275,0.1843),warm=vec3(0.6902,0.5647,0.4392);
          return hueRotateSepia(mix(mix(moss,brown,t),warm,t*t*0.32));
        }
        void main(){
          vec2 uv=(gl_FragCoord.xy-0.5*u_resolution.xy)/u_resolution.y;
          float grain=noise(gl_FragCoord.xy*0.85+u_time*0.35)*0.06;
          vec3 ro=vec3(0,0,-1.6),rd=normalize(vec3(uv,1.5));
          float t=0.0,glow=0.0;
          for(int i=0;i<72;i++){ vec3 p=ro+rd*t; float d=map(p); glow+=0.014/(0.06+abs(d)); if(d<0.002)break; t+=d*0.72; if(t>9.0)break; }
          float lum=smoothstep(0.0,1.6,glow)*(0.65+0.5*sin(u_time*0.28)*0.18);
          vec3 col=palette(clamp(lum,0.0,1.0)); col+=vec3(grain); col*=0.72*smoothstep(1.28,0.12,length(uv));
          col=tanh(mix(vec3(dot(col,vec3(0.299,0.587,0.114))),col,1.1)*1.3);
          gl_FragColor=vec4(col,0.22+lum*0.18+smoothstep(9.0,2.0,t)*0.04);
        }
      `;
      function compile(type, src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); return s; }
      const prog=gl.createProgram();
      gl.attachShader(prog,compile(gl.VERTEX_SHADER,vertexSrc));
      gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,fragmentSrc));
      gl.linkProgram(prog); gl.useProgram(prog);
      const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(prog,'a_position'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
      const uT=gl.getUniformLocation(prog,'u_time'), uR=gl.getUniformLocation(prog,'u_resolution');
      function resize(){ const d=Math.min(devicePixelRatio||1,2); canvas.width=Math.floor(innerWidth*d); canvas.height=Math.floor(innerHeight*d); gl.viewport(0,0,canvas.width,canvas.height); }
      window.addEventListener('resize',resize); resize();
      function render(t){ gl.uniform1f(uT,t*0.001); gl.uniform2f(uR,canvas.width,canvas.height); gl.drawArrays(gl.TRIANGLES,0,6); requestAnimationFrame(render); }
      requestAnimationFrame(render);
    })();
  </script>
</body>
</html>
```
