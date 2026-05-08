---
version: alpha
name: Auralis
description: Auralis Neural Audio Engine design system — white canvas, vibrant orange (#EA580C) accent, Geist + JetBrains Mono typography, chamfered clip-path shapes, WebGL gradient atmosphere, and GSAP-powered motion. Use this as the visual foundation and expand it into a full application for whatever the user's prompt describes.
---

# Auralis Design System

Build a complete, production-quality web application using the Auralis design language as the visual foundation. The user's prompt describes *what* to build — this skill describes *how it should look and feel*.

You are not recreating the Auralis login page. You are using its design DNA — palette, type, shapes, motion, atmosphere — to build whatever the user asks for. Every screen, component, and interaction you create should feel like it belongs in the same product family.

## Color Palette

| Token | Hex | Role |
|---|---|---|
| primary | `#EA580C` | Vibrant orange. Accent color for CTAs, active states, badges, icons, gradient anchors. |
| secondary | `#FFFFFF` | White. Buttons text on dark, card backgrounds. |
| accent | `#FDBA74` | Peach/light orange. Gradient endpoints, soft highlights, hover tints. |
| background | `#FFFFFF` | Page canvas. Always white — not off-white, not grey. |
| surface | `#191C21` | Dark navy-charcoal. Used for dark sections, footer, dark cards — never as the main background. |
| text-primary | `#111827` | Near-black. All headings and primary body text. |
| text-secondary | `#4B5563` | Medium grey. Subheadings, descriptions, secondary copy. |
| border | `#E5E7EB` | Light grey. Card borders, dividers, input outlines. |

**Gradient accents**: orange-to-rose (`#ea580c` → `#e11d48`) for gradient text, border treatments, and decorative elements. Selection highlight uses `selection:bg-orange-100 selection:text-orange-900`.

## Typography

**Two font families, strict roles:**

- **Geist** — everything except code/labels. Load from Google Fonts with weights 300, 400, 500, 600, 700.
- **JetBrains Mono** (weight 600, 12px) — technical labels, metadata, mono-spaced UI elements.

**Heading scale:**

Display headings use Geist at `font-light` (300) with `tracking-tighter` and extremely tight line-height (~1.04–1.05). Sizes step from `text-5xl` up to `text-8xl` responsively. The light weight at large size is the Auralis signature — do not use bold for display text.

Body text uses Geist weight 400, 16px, line-height 1.6.

Labels and small UI text use weight 400–500 at `text-sm` or `text-xs`.

## Shapes — Chamfered Clip-Path

This is the defining shape language. Buttons, badges, icon containers, and cards do NOT use `border-radius`. They use a **chamfered polygon clip-path** that cuts diagonal corners:

**Large (buttons, cards)** — 12px chamfer:
```css
clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
```

**Small (badges, icon boxes)** — 8px chamfer:
```css
clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
```

Apply these consistently to: primary/secondary buttons, feature icon containers, badge pills, card containers, and any new interactive elements you create. Standard `rounded-lg` / `rounded-xl` is acceptable for inputs, dropdowns, and tooltips where clip-path would clip content.

## Button Hierarchy

**Primary button** — dark near-black background (`bg-[#1c1c1e]`), white text, 12px chamfered clip-path. Layered box-shadow for depth. Hover: lift (`-translate-y-0.5`) + darken to black.

**Secondary button** — transparent/glass background with `backdrop-blur-md`, orange-600 text, gradient border (orange→rose via the `background: linear-gradient(...) padding-box, linear-gradient(...) border-box` + `border: 1px solid transparent` technique). Same chamfered clip-path. Hover: lift + darken text.

**Gradient border technique** (for secondary buttons and badges):
```css
border: 1px solid transparent;
background: linear-gradient(rgba(255,255,255,0.6), rgba(255,255,255,0.6)) padding-box,
            linear-gradient(135deg, #fdba74, #fda4af) border-box;
```

## Layout

- Max container width: `max-w-[88rem]`, centered, with responsive horizontal padding (`px-6 sm:px-8 md:px-12 lg:px-16`).
- Use flex and grid layouts. The Auralis style favors left-aligned hero content with atmospheric effects on the right — but adapt this to the app's needs.
- Generous vertical spacing between sections (`py-16` to `py-24`).
- Feature rows use horizontal flex with `gap-10 sm:gap-14`, often separated by a top border.

## Icons

Use **Iconify** with the **Solar** icon set (linear style). Load via:
```html
<script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
```
Usage: `<iconify-icon icon="solar:icon-name-linear" class="text-xl"></iconify-icon>`

Feature icon containers: 44×44px (`h-11 w-11`), `bg-orange-50`, `text-orange-500`, 8px chamfered clip-path, subtle box-shadow. Hover: `scale-110` transition.

## Motion & Animation

**Staggered entrance** — elements with class `anim-element` start at `opacity: 0; transform: translateY(15px)` and animate in with `transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1)`, staggered by 80ms increments via JavaScript `setTimeout`.

**Masked word reveal** (for hero headlines) — GSAP-powered. Each word wraps in `<span class="inline-flex overflow-hidden"><span class="gs-reveal-word translate-y-[110%]">Word</span></span>`. GSAP animates `y: '0%'` with `power4.out` easing, 1.2s duration, 0.1s stagger, triggered by ScrollTrigger at `top 85%`.

**Hover effects** — buttons lift 0.5px (`hover:-translate-y-0.5`), feature icons scale 110%.

Include GSAP + ScrollTrigger for scroll-triggered animations:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
```

## WebGL Atmospheric Background

The Auralis signature includes a full-viewport animated gradient canvas using Three.js and simplex noise. It sits fixed behind content on the right side of the viewport, with a glass-slice overlay that creates a frosted-glass-to-clear transition from left to right.

**Include this effect when the app has a hero/landing section.** For interior app pages (dashboards, settings, lists), skip the WebGL canvas — use subtle gradient backgrounds or the orange accent color sparingly instead.

Canvas colors in the shader: intense orange `(0.91, 0.34, 0.04)`, bright rose `(0.88, 0.11, 0.28)`, warm base `(1.0, 0.85, 0.65)`.

The glass overlay uses 5 vertical strips with decreasing opacity and increasing backdrop-blur, creating a seamless blend from the white content area into the gradient.

Load Three.js:
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
```

## Expanding the Design System

When the user's prompt requires components not covered above, create them following these principles:

- **Cards**: white background, `border border-[#E5E7EB]`, 8px or 12px chamfered clip-path, `p-6` padding, subtle layered box-shadow.
- **Inputs**: `rounded-lg` (standard radius is fine here), `border-[#E5E7EB]`, focus ring in orange-500.
- **Tables / data displays**: clean lines, `text-sm`, `border-b border-[#E5E7EB]` row separators, no zebra striping.
- **Navigation / sidebars**: surface color (`#191C21`) for dark nav, or white with border for light nav. Active item indicated by orange-500 accent.
- **Modals / dialogs**: white background, 12px chamfered clip-path, backdrop blur overlay.
- **Status indicators**: orange for active/primary, green for success, red for error, grey for inactive.
- **Dark sections**: use `bg-[#191C21]` with white/light text. Keep these to accent bands — the base canvas is always white.

## Guardrails

- Do not flatten the design into a generic card grid with rounded corners. The chamfered clip-path shapes are the defining visual element.
- Do not swap to a dark-mode-first design. White canvas is the base; dark surface is for accent sections only.
- Do not use a color palette other than the one defined above. Orange is primary — no blue, no purple, no teal.
- Preserve the Geist light-weight display headline style. Bold headlines break the aesthetic.
- Keep buttons, badges, and interactive elements consistent with the chamfered shape language.
- Use real, descriptive placeholder content — no lorem ipsum, no foo/bar.
- Every page should feel like part of the Auralis product family even if the content is completely different from the original audio engine theme.

## Reference HTML

The HTML below is the canonical source of truth for this design system. Study it for exact class names, inline styles, shadow values, clip-path usage, animation setup, and WebGL shader code. When in doubt about how to implement a pattern, refer back to this HTML.

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auralis - Neural Audio Engine</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="antialiased text-gray-900 bg-white overflow-x-hidden min-h-screen flex flex-col selection:bg-orange-100 selection:text-orange-900" style="font-family: 'Geist', sans-serif;">

    <!-- Background Effect Container -->
    <div class="fixed inset-y-0 right-0 w-[120vw] md:w-[70vw] translate-x-[10%] md:translate-x-0 z-0 overflow-hidden pointer-events-none">

        <!-- WebGL Animated Gradient Canvas -->
        <canvas id="webgl-canvas" class="absolute inset-0 w-full h-full"></canvas>

        <!-- Glass Slices Overlay -->
        <div class="absolute inset-0 flex">
            <div class="h-full flex-1 relative border-l border-transparent" style="background: linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 100%);"></div>
            <div class="h-full flex-1 relative border-l border-white/60 shadow-[-15px_0_30px_-10px_rgba(255,255,255,1)]" style="background: linear-gradient(to right, rgba(255,255,255,0.85), rgba(255,255,255,0.65)); backdrop-filter: blur(16px);"></div>
            <div class="h-full flex-1 relative border-l border-white/40 shadow-[-15px_0_30px_-10px_rgba(255,255,255,0.9)]" style="background: linear-gradient(to right, rgba(255,255,255,0.65), rgba(255,255,255,0.4)); backdrop-filter: blur(12px);"></div>
            <div class="h-full flex-1 relative border-l border-white/20 shadow-[-15px_0_30px_-10px_rgba(255,255,255,0.6)]" style="background: linear-gradient(to right, rgba(255,255,255,0.4), rgba(255,255,255,0.15)); backdrop-filter: blur(6px);"></div>
            <div class="h-full flex-1 relative border-l border-white/10 shadow-[-15px_0_30px_-10px_rgba(255,255,255,0.3)]" style="background: linear-gradient(to right, rgba(255,255,255,0.15), rgba(255,255,255,0.02)); backdrop-filter: blur(2px);"></div>
        </div>
    </div>

    <!-- Main Content Container -->
    <div class="relative z-10 w-full max-w-[88rem] mx-auto px-6 sm:px-8 md:px-12 lg:px-16 flex flex-col min-h-screen">

        <!-- Header -->
        <header class="flex items-center justify-between py-8 anim-element" style="opacity: 0; transform: translateY(-10px); transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);">
            <div class="flex items-center gap-1 text-lg font-normal tracking-tight text-gray-900 uppercase">
                AURALIS<span class="text-[#ea580c] text-xl leading-none">°</span>
            </div>
            <nav class="hidden md:flex items-center gap-10 text-sm font-normal text-gray-600">
                <a href="#" class="hover:text-gray-900 transition-colors">Platform</a>
                <a href="#" class="hover:text-gray-900 transition-colors">Solutions</a>
                <a href="#" class="hover:text-gray-900 transition-colors">Developers</a>
                <a href="#" class="hover:text-gray-900 transition-colors">Company</a>
                <a href="#" class="hover:text-gray-900 transition-colors">Docs</a>
            </nav>
            <div>
                <a href="#" class="text-sm font-normal text-gray-600 hover:text-gray-900 transition-colors">Sign in</a>
            </div>
        </header>

        <!-- Hero Section -->
        <main class="flex-1 flex flex-col justify-center max-w-2xl pt-16 pb-24">

            <!-- Badge -->
            <div class="anim-element mb-8 w-max inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-normal text-orange-600 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] backdrop-blur-md" style="clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px); border: 1px solid transparent; background: linear-gradient(rgba(255,237,213,0.6), rgba(255,237,213,0.6)) padding-box, linear-gradient(135deg, #fdba74, #fda4af) border-box; opacity: 0; transform: translateY(15px); transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);">
                <iconify-icon icon="solar:microphone-3-linear" class="text-base" stroke-width="1.5"></iconify-icon>
                Advanced Vocal Synthesis
            </div>

            <!-- Headline with Masked Reveal -->
            <h1 class="text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-gray-900 leading-[1.05] font-light tracking-tighter gs-reveal-container">
                <span class="inline-flex overflow-hidden pb-1 pt-1"><span class="gs-reveal-word translate-y-[110%] will-change-transform">Converse</span></span>
                <span class="inline-flex overflow-hidden pb-1 pt-1"><span class="gs-reveal-word translate-y-[110%] will-change-transform">Naturally.</span></span><br>
                <span class="inline-flex overflow-hidden pb-1 pt-1"><span class="gs-reveal-word translate-y-[110%] will-change-transform">Beyond</span></span>
                <span class="inline-flex overflow-hidden pb-1 pt-1"><span class="gs-reveal-word translate-y-[110%] will-change-transform">Boundaries.</span></span><br>
                <span class="inline-flex overflow-hidden pb-1 pt-1"><span class="gs-reveal-word translate-y-[110%] will-change-transform text-transparent bg-clip-text bg-gradient-to-r from-[#ea580c] to-[#e11d48]">Infinite Scale.</span></span>
            </h1>

            <!-- Subheadline -->
            <p class="anim-element mt-7 text-base md:text-lg text-gray-600 leading-relaxed max-w-[28rem]" style="opacity: 0; transform: translateY(15px); transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); transition-delay: 0.3s;">
                Generate highly realistic human audio instantly, replicating vocal signatures with stunning precision. Embed smoothly into applications, media, and interactive interfaces. Swift. Private. Broadcast-ready.
            </p>

            <!-- CTA Buttons -->
            <div class="anim-element mt-10 flex flex-wrap items-center gap-4" style="opacity: 0; transform: translateY(15px); transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); transition-delay: 0.4s;">
                <a href="#" class="inline-flex items-center justify-center gap-2 bg-[#1c1c1e] px-7 py-3.5 text-sm font-normal text-white hover:bg-black transition-all duration-300 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),_0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5" style="clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);">
                    Start building today
                    <iconify-icon icon="solar:arrow-right-up-linear" class="text-lg opacity-80" stroke-width="1.5"></iconify-icon>
                </a>
                <a href="#" class="inline-flex items-center justify-center backdrop-blur-md px-7 py-3.5 text-sm font-normal text-orange-600 hover:text-orange-700 hover:-translate-y-0.5 transition-all duration-300 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]" style="clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px); border: 1px solid transparent; background: linear-gradient(rgba(255,255,255,0.6), rgba(255,255,255,0.6)) padding-box, linear-gradient(135deg, #fdba74, #fda4af) border-box;">
                    Contact Enterprise
                </a>
            </div>
        </main>

        <!-- Bottom Features Row -->
        <div class="anim-element pb-12 pt-8 flex flex-col sm:flex-row gap-10 sm:gap-14 border-t border-transparent" style="opacity: 0; transform: translateY(15px); transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1); transition-delay: 0.5s;">
            <div class="flex items-center gap-4 group cursor-default">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center bg-orange-50 text-orange-500 group-hover:scale-110 transition-transform duration-300 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]" style="clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);">
                    <iconify-icon icon="solar:server-linear" class="text-xl" stroke-width="1.5"></iconify-icon>
                </div>
                <div>
                    <h3 class="text-sm font-normal text-gray-900">Seamless Streaming</h3>
                    <p class="text-xs text-gray-500 mt-0.5">Instant voice generation</p>
                </div>
            </div>
            <div class="flex items-center gap-4 group cursor-default">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center bg-orange-50 text-orange-500 group-hover:scale-110 transition-transform duration-300 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]" style="clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);">
                    <iconify-icon icon="solar:soundwave-linear" class="text-xl" stroke-width="1.5"></iconify-icon>
                </div>
                <div>
                    <h3 class="text-sm font-normal text-gray-900">Vocal Cloning</h3>
                    <p class="text-xs text-gray-500 mt-0.5">Studio-grade precision</p>
                </div>
            </div>
            <div class="flex items-center gap-4 group cursor-default">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center bg-orange-50 text-orange-500 group-hover:scale-110 transition-transform duration-300 shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]" style="clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);">
                    <iconify-icon icon="solar:shield-check-linear" class="text-xl" stroke-width="1.5"></iconify-icon>
                </div>
                <div>
                    <h3 class="text-sm font-normal text-gray-900">Enterprise-Ready</h3>
                    <p class="text-xs text-gray-500 mt-0.5">Flawless commercial uptime</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Scripts for WebGL and Animations -->
    <script>
        // --- WebGL Background Animation (Warm Palette Remix) ---
        const canvas = document.getElementById('webgl-canvas');
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geometry = new THREE.PlaneGeometry(2, 2);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0.0 },
                u_resolution: { value: new THREE.Vector2() }
            },
            vertexShader: `
                void main() {
                    gl_Position = vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float u_time;
                uniform vec2 u_resolution;

                vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
                float snoise(vec2 v){
                    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
                    vec2 i  = floor(v + dot(v, C.yy) );
                    vec2 x0 = v -   i + dot(i, C.xx);
                    vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
                    i = mod(i, 289.0);
                    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                    m = m*m ; m = m*m ;
                    vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5;
                    vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
                    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
                    vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y;
                    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                    return 130.0 * dot(m, g);
                }

                void main() {
                    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
                    float n = snoise(uv * 2.5 + vec2(u_time * 0.4, u_time * 0.5));
                    float n2 = snoise(uv * 1.5 - vec2(u_time * 0.3, u_time * 0.2));
                    vec3 colorOrange = vec3(0.91, 0.34, 0.04);
                    vec3 colorRose = vec3(0.88, 0.11, 0.28);
                    vec3 colorDeep = vec3(1.0, 0.85, 0.65);
                    float mixVal = smoothstep(-0.6, 0.8, n);
                    vec3 finalColor = mix(colorDeep, colorOrange, mixVal);
                    float mixVal2 = smoothstep(-0.4, 0.9, n2);
                    finalColor = mix(finalColor, colorRose, mixVal2 * 0.8);
                    float alphaFade = smoothstep(-0.2, 0.6, uv.x);
                    gl_FragColor = vec4(finalColor, alphaFade);
                }
            `
        });

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        function resizeCanvas() {
            renderer.setSize(window.innerWidth, window.innerHeight);
            material.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function animateWebGL(time) {
            material.uniforms.u_time.value = time * 0.002;
            renderer.render(scene, camera);
            requestAnimationFrame(animateWebGL);
        }
        requestAnimationFrame(animateWebGL);

        // --- GSAP Masked Reveal & standard entrance animations ---
        document.addEventListener('DOMContentLoaded', () => {
            gsap.registerPlugin(ScrollTrigger);
            gsap.to('.gs-reveal-word', {
                y: '0%',
                ease: 'power4.out',
                duration: 1.2,
                stagger: 0.1,
                scrollTrigger: {
                    trigger: '.gs-reveal-container',
                    start: 'top 85%',
                }
            });
            const elements = document.querySelectorAll('.anim-element');
            elements.forEach((el, index) => {
                setTimeout(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, 100 + (index * 80));
            });
        });
    </script>
</body>
</html>
```
