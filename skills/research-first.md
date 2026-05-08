---
version: alpha
name: Research First
description: Before writing any code, research UI/UX best practices for the user's prompt, create a structured design document (design.md), plan component architecture, then implement. Produces more intentional, well-structured output by frontloading design thinking.
---

# Research First

**Override the default workflow.** Do not jump into writing code. Follow these phases strictly in order. Each phase must produce a concrete artifact before the next begins.

## Phase 1 — Research (before any code)

Investigate what makes excellent UI/UX for the type of application the user described. Use Bash with `curl` to fetch real-world references:

```bash
# Search for UI/UX best practices related to the prompt
curl -s "https://html.duckduckgo.com/html/?q=best+UI+UX+practices+<topic>+2024+2025" | grep -oP '(?<=<a rel="nofollow" class="result__a" href=")[^"]*' | head -8
```

```bash
# Fetch a relevant article for patterns and ideas
curl -sL "<url>" | sed 's/<[^>]*>//g' | tr -s ' \n' | head -120
```

Research at least 3 sources. Extract and note:
- Common layout patterns for this type of app (what sections appear, in what order)
- Navigation conventions (sidebar vs top nav, mobile patterns)
- Typography and hierarchy patterns (how similar products structure headings, body, CTAs)
- Color strategy (what palette approaches work for this industry/domain)
- Interaction patterns (hover states, transitions, micro-interactions users expect)
- Accessibility considerations specific to this app type
- Content strategy (what copy tone and length works — technical, friendly, minimal)

If `curl` fails or returns unusable results, draw on your training knowledge of UI/UX best practices for this app category, but explicitly document what you found vs what you're drawing from general knowledge.

## Phase 2 — Design Document

Create `src/design.md` with the following structure. This is your blueprint — every decision you make in code traces back to this document.

```markdown
# Design Document: [App Name]

## Research Findings
- [3-5 bullet points summarizing what you learned from research]
- [Specific patterns you'll adopt and why]
- [Patterns you'll intentionally avoid and why]

## Information Architecture
- Page sections in order (what appears first, second, etc.)
- Content hierarchy within each section
- User flow / reading path through the page

## Layout System
- Container strategy (max-width, padding, responsive breakpoints)
- Grid approach per section (columns, gaps, stacking behavior)
- Spacing scale (what values you'll use for section gaps, card padding, element spacing)

## Visual Design Tokens
### Colors
- Primary: [hex] — [where and why]
- Secondary: [hex] — [where and why]
- Background: [hex]
- Surface: [hex] — for cards/elevated elements
- Text primary: [hex]
- Text secondary: [hex]
- Accent/CTA: [hex]
- Border: [hex]
- Semantic: success [hex], warning [hex], error [hex]

### Typography
- Font stack: [families]
- Display: [size, weight, line-height, tracking]
- Heading: [size, weight, line-height]
- Body: [size, weight, line-height]
- Small/caption: [size, weight]
- Why this type system fits the app's tone

### Shapes
- Border radius scale (what radius for cards, buttons, inputs, avatars)
- Elevation strategy (shadows, borders, or gradients — and why)

## Component Inventory
List every component you'll build, with:
- Name
- Purpose
- Key props / variants
- Which section(s) it appears in

Example:
- **HeroSection** — full-width intro with headline, subtitle, 2 CTAs, background treatment
- **FeatureCard** — icon + title + description, used in 3-column grid
- **PricingTier** — name, price, feature list, CTA button, "popular" variant
- **TestimonialCard** — quote, avatar, name, role, company

## Component Tree
```
App
├── Navbar
├── HeroSection
├── SocialProof (logo bar)
├── FeaturesGrid
│   └── FeatureCard ×6
├── HowItWorks
│   └── StepCard ×3
├── PricingSection
│   └── PricingTier ×3
├── Testimonials
│   └── TestimonialCard ×3
├── CTABanner
└── Footer
```

## Responsive Strategy
- Mobile-first or desktop-first (and why)
- Key breakpoints and what changes at each
- Components that fundamentally restructure vs just reflow

## Accessibility Plan
- Semantic HTML elements for each section
- Focus management considerations
- Color contrast targets
- ARIA landmarks
```

## Phase 3 — Implement

Now write code, following the design document precisely:

1. **Start with the component tree** — create all component files first as empty shells with the correct exports, so imports never break during development.
2. **Build leaf components first** (FeatureCard, PricingTier, etc.), then compose them into section components, then wire into App.tsx.
3. **Apply design tokens consistently** — reference your design.md color/type/spacing decisions. Don't improvise new values mid-implementation.
4. **Add responsive behavior** as you build each component, not as an afterthought.
5. **Use semantic HTML** — `<header>`, `<main>`, `<section>`, `<nav>`, `<footer>`, `<article>` where appropriate.
6. **Add smooth scroll behavior** and subtle transitions (hover states, entrance animations if appropriate).

## Phase 4 — Self-Review

Before your final message, re-read `src/design.md` and compare it against your implementation:
- Are all planned sections present?
- Do colors/typography/spacing match the design tokens?
- Does the component tree match what you planned?
- Is the responsive behavior implemented as specified?
- Are there accessibility gaps?

Note any deviations in your final summary and explain why you diverged.

## Rules

- **Never skip Phase 1 or Phase 2.** The design document must exist before any `.tsx` file is written.
- **The design.md is a living artifact.** If you discover during implementation that a design decision doesn't work, update design.md first, then change the code.
- **Prefer fewer, well-designed components** over many shallow ones. Each component should have a clear responsibility.
- **Use realistic content.** Real-sounding names, companies, metrics, testimonial quotes. No lorem ipsum, no placeholder-123.
- **If a design skill (Auralis, Warm Paper, BMW, etc.) is also loaded**, do your research phase first, then read the design skill, then merge the design skill's visual language into your design.md. The design skill provides the visual system; this skill provides the process.
