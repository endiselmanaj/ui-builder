# Anthropic Elite Frontend UX

Create distinctive, production-grade frontend interfaces with expert-level UX design. Combines bold aesthetic direction with systematic design tokens, WCAG accessibility, conversion optimization, and Tailwind/React best practices. Produces polished, memorable interfaces that avoid generic AI aesthetics.

## 1. Design Philosophy

Before writing code, commit to a clear direction:

**Context Analysis:**
- WHO uses this? (persona, expertise level, device context)
- WHAT action should they take? (single primary goal)
- WHY should they trust/engage? (value proposition)

**Aesthetic Commitment:**
Choose and COMMIT to a bold direction. Timid design fails. Options include:
- Brutally minimal (Stripe, Linear)
- Maximalist editorial (Bloomberg, Awwwards winners)
- Retro-futuristic (Y2K revival, vaporwave)
- Organic/natural (earthy, hand-drawn, textured)
- Luxury/refined (fashion houses, premium brands)
- Playful/toy-like (Figma, Notion)
- Neo-brutalist (raw, exposed, intentionally rough)
- Art deco/geometric (bold shapes, gold accents)
- Soft/pastel (gradient meshes, dreamy)
- Industrial/utilitarian (data-dense, functional)

**The Memorability Test:** What ONE thing will users remember? If you can't answer this, the design lacks focus.

---

## 2. Design Token System

Use these systematic values. Never eyeball spacing or pick arbitrary colors.

### Typography Scale
```
--font-size-xs:   0.75rem   /* 12px - captions, labels */
--font-size-sm:   0.875rem  /* 14px - secondary text */
--font-size-base: 1rem      /* 16px - body text (MINIMUM for mobile) */
--font-size-lg:   1.125rem  /* 18px - lead paragraphs */
--font-size-xl:   1.25rem   /* 20px - H4 */
--font-size-2xl:  1.5rem    /* 24px - H3 */
--font-size-3xl:  2rem      /* 32px - H2 */
--font-size-4xl:  2.5rem    /* 40px - H1 */
--font-size-5xl:  3.5rem    /* 56px - Display */
```

**Typography Rules:**
- Line height: 1.5-1.6 for body, 1.1-1.2 for headings
- Line length: 45-75 characters (use `max-w-prose` or `max-w-2xl`)
- Maximum 2-3 typefaces per design
- NEVER use: Inter, Roboto, Arial as primary fonts (overused AI defaults)
- PAIR: One distinctive display font + one refined body font

**Distinctive Font Suggestions:**
- Display: Fraunces, Instrument Serif, Playfair Display, Space Grotesk, Clash Display, Cabinet Grotesk, Satoshi
- Body: Source Serif Pro, IBM Plex Sans, Libre Franklin, Work Sans, Plus Jakarta Sans

### Spacing Scale (8px base)
```
--space-0:  0
--space-1:  0.25rem   /* 4px */
--space-2:  0.5rem    /* 8px */
--space-3:  0.75rem   /* 12px */
--space-4:  1rem      /* 16px */
--space-6:  1.5rem    /* 24px */
--space-8:  2rem      /* 32px */
--space-12: 3rem      /* 48px */
--space-16: 4rem      /* 64px */
--space-20: 5rem      /* 80px */
--space-24: 6rem      /* 96px */
--space-32: 8rem      /* 128px - section gaps */
```

### Color System
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --primary: 222 47% 11%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 210 40% 96%;
  --destructive: 0 84% 60%;
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
  --border: 214 32% 91%;
  --radius: 0.5rem;
}
```

**Color Rules:**
- 60-30-10 ratio: 60% dominant, 30% secondary, 10% accent
- ONE bold accent color maximum
- NEVER purple gradients on white (AI cliche)

### Animation Timing
```
--duration-fast:    100ms   /* Button clicks, toggles */
--duration-normal:  200ms   /* Most transitions */
--duration-slow:    300ms   /* Modals, drawers */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1)
--ease-out:     cubic-bezier(0, 0, 0.2, 1)
--ease-bounce:  cubic-bezier(0.34, 1.56, 0.64, 1)
```

- ONLY animate `transform` and `opacity` (GPU accelerated)
- NEVER animate `width`, `height`, `margin`, `padding`
- Respect `prefers-reduced-motion`

---

## 3. Accessibility Requirements (Non-Negotiable)

### Color Contrast (WCAG 2.1 AA)
| Element | Minimum Ratio |
|---------|---------------|
| Body text | 4.5:1 |
| Large text (18pt+) | 3:1 |
| UI components, icons | 3:1 |
| Focus indicators | 3:1 |

### Touch Targets
- Minimum size: 44x44px
- Minimum spacing: 8px between adjacent targets

### Interactive Elements
- ALL interactive elements MUST have visible focus states
- NEVER use `outline: none` without a replacement
- Tab order must be logical

### Forms
- Every input MUST have an associated `<label>`
- Error messages: `aria-describedby`
- Use `autocomplete` attributes

### Semantic HTML
Use `<button>` not `<div onclick>`. Use `<a href>` not `<span class="link">`. First rule of ARIA: Don't use ARIA if native HTML works.

---

## 4. SaaS Dashboard Patterns

### Layout Architecture
```
Top Bar (56-64px): Logo, Search, User Menu
Sidebar (240-280px, collapsible to 64-80px)
Main Content Area with Cards / Data / Forms
```

### Dashboard Content Hierarchy
1. Value-first metrics: "You saved 4 hours" > raw numbers
2. Actionable insights: What should user do next?
3. Progressive disclosure: Summary then detail on demand
4. Role-based views: Different personas need different data

### Empty States
Always provide: icon, helpful title, description, and an action button. Never just show "No data".

### Toast/Notification Timing
- Default: 4-5 seconds
- Minimum for accessibility: 6 seconds
- Always include dismiss button

---

## 5. Landing Page Patterns

### Above-the-Fold Essentials
1. Clear headline (5-10 words)
2. Supporting subheadline (value proposition)
3. Single primary CTA
4. Visual element

### Section Flow
Hero > Social Proof > Problem/Solution > Features (3-4 max) > Testimonials > Pricing > FAQ > Final CTA > Footer

### CTA Button Design
- Minimum 44px height
- Warm colors create urgency
- Action verbs, first-person ("Get my free trial" > "Sign up")
- One primary CTA per viewport

### Form Optimization
- Single column layout
- Minimize fields (4 fields vs 11 = 120% more conversions)
- Labels above inputs
- Validate on blur, not while typing

---

## 6. Anti-Patterns (NEVER DO)

### Visual
- Purple/blue gradients on white (AI cliche)
- Inter, Roboto, Arial as display fonts
- Inconsistent border-radius
- More than 3 font weights
- Rainbow color schemes without purpose

### UX
- Confirmshaming
- Pre-selected options benefiting company over user
- Infinite scroll without pagination option
- Disabled submit buttons before user attempts
- Placeholder text as labels

### Technical
- `outline: none` without focus replacement
- `<div onclick>` instead of `<button>`
- Dynamic Tailwind classes (`bg-${color}-500`)
- Animating layout properties
- Missing `alt` text on images
- Forms without labels

---

## 7. Pre-Delivery Checklist

### Accessibility
- Color contrast >= 4.5:1 (text) / 3:1 (UI)
- Touch targets >= 44x44px
- All images have `alt` text
- All form fields have `<label>`
- Visible focus states on all interactive elements

### Visual Design
- Clear typographic hierarchy (3-5 levels)
- Consistent spacing from token scale
- Maximum 2-3 typefaces
- Cohesive color palette (60-30-10)
- ONE memorable design element

### Technical
- Mobile-first responsive approach
- Animations use only transform/opacity
- Dark mode support via CSS variables
- `prefers-reduced-motion` respected

Remember: Bold aesthetic choices + systematic execution = memorable interfaces. Generic is the enemy. Commit to a direction and execute with precision.
