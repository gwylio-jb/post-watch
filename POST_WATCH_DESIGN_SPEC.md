# Post_Watch — UI/UX Design Specification
## Version 2.0 | A Gwylio Product

> This document is the authoritative design reference for Post_Watch v2.0.
> All UI decisions should defer to this spec. Where v1.0 diverges from it, v2.0 should align to this spec.

---

## 1. Brand Identity

### 1.1 Product Name

The product name is `Post_Watch`. The underscore is load-bearing — it is not decorative and must never be omitted.

**Usage rules:**
- Display name: `Post_Watch`
- Lowercase/URL/code contexts: `post_watch`
- All-caps contexts (headers, terminal output): `POST_WATCH`
- Abbreviated mark (favicon, icon, badge): `P_W`
- Truncated prefix (CLI prompt, alert labels): `Post_`
- Parent attribution: `by gwylio` (lowercase, monospace, muted)

### 1.2 Taglines

| Context | Tagline |
|---|---|
| Primary / nav | `// Stay compliant. Stay secure.` |
| Sub-header / module headers | `Audit. Protect. Report.` |
| Landing / hero | `ISO 27001 compliance and WordPress security, unified.` |
| Brand / campaign | `Always watching. Always ready.` |

The primary tagline uses code-comment syntax (`//`) intentionally. Render it in monospace.

### 1.3 Relationship to Gwylio

Post_Watch is a Gwylio product. The parent attribution appears in:
- App footer: `a gwylio product`
- Login/onboarding screens: lockup treatment (see Section 4)
- Document headers/report cover pages

Do not display the Gwylio wordmark as an image asset inside the app UI — use the text lockup only.

---

## 2. Colour Palette

These are the exact Gwylio brand colours. Do not substitute or approximate.

### 2.1 Core Palette

| Role | Name | Hex | Usage |
|---|---|---|---|
| Primary accent | Mint | `#00D9A3` | CTAs, active states, underscore, links, pass/compliant indicators |
| Primary dark | Navy | `#1A2332` | Dark backgrounds, primary text on light, sidebar |
| Secondary | Violet | `#8B5CF6` | Risk module, intelligence features, secondary CTAs |
| Alert | Ember | `#FF4A1C` | Threat indicators, alerts, fail states, destructive actions |
| Background | Cloud | `#F8F9FA` | Light surface background, card backgrounds |

### 2.2 Derived / Extended Palette

Derive these from the core palette for UI depth. Do not introduce colours outside this system.

| Role | Hex | Derivation |
|---|---|---|
| Dark surface (sidebar, nav) | `#1A2332` | Navy — primary |
| Darker navy (hover states on dark) | `#111827` | Navy darkened |
| Mint muted (secondary badges, borders) | `#00B589` | Mint at 85% |
| Mint subtle (backgrounds, hover fills) | `#E6FAF5` | Mint at 10% opacity on white |
| Violet muted | `#7C3AED` | Violet darkened |
| Violet subtle | `#F3F0FF` | Violet at 10% opacity on white |
| Ember muted | `#CC3A15` | Ember darkened |
| Ember subtle | `#FFF1EE` | Ember at 10% opacity on white |
| Border default | `#E5E7EB` | Neutral grey |
| Border strong | `#D1D5DB` | Neutral grey darker |
| Text primary | `#1A2332` | Navy |
| Text secondary | `#4B5563` | Neutral grey |
| Text tertiary | `#9CA3AF` | Neutral grey light |

### 2.3 Semantic Colour Mapping

| State | Colour | Hex |
|---|---|---|
| Compliant / Pass / Success | Mint | `#00D9A3` |
| In Progress / Partial | Violet | `#8B5CF6` |
| Non-Compliant / Fail / Alert | Ember | `#FF4A1C` |
| Not Assessed / N/A | Text tertiary | `#9CA3AF` |
| Informational | Navy | `#1A2332` |

---

## 3. Typography

### 3.1 Font Stack

Post_Watch uses two Adobe Fonts as its primary typefaces. Google Fonts fallbacks are specified for environments where Adobe Fonts are unavailable (e.g. Claude Code preview, staging environments, third-party integrations).

| Role | Primary (Adobe Fonts) | Google Fonts fallback | Final fallback |
|---|---|---|---|
| Headings | `'Azo Sans'` (Black / weight 900) | `'Archivo Black'`, `'Montserrat'` (weight 900) | `sans-serif` |
| Body / UI | `'Ingra'` (Regular / weight 400) | `'Plus Jakarta Sans'`, `'Nunito Sans'` | `system-ui, sans-serif` |
| Wordmark / product name | `'Ingra'` or monospace | `'JetBrains Mono'`, `'Fira Code'` | `'Courier New', monospace` |
| Code / terminal output | Monospace | `'JetBrains Mono'`, `'Fira Code'` | `'Courier New', monospace` |

**About the primary fonts:**
- **Azo Sans Black** — a geometric sans with humanist warmth, inspired by 1920s constructivist typefaces. Used exclusively for headings. Its Black weight gives strong hierarchy without requiring additional weight variation elsewhere. Load via Adobe Fonts: `font-family: 'azo-sans', sans-serif; font-weight: 900;`
- **Ingra Regular** — a contemporary humanist sans designed for UI legibility. Used for all body text, labels, navigation, and UI copy. Its open apertures and clean letterforms read well at small sizes on screen. Load via Adobe Fonts: `font-family: 'ingra', sans-serif; font-weight: 400;`

**Google Fonts fallback note:**
- `Archivo Black` is the closest available match to Azo Sans Black — both are geometric with strong, uniform strokes at heavy weight. Import: `https://fonts.googleapis.com/css2?family=Archivo+Black&family=Montserrat:wght@900`
- `Plus Jakarta Sans` is the closest match to Ingra Regular — a contemporary humanist sans with similar open letterforms and x-height. `Nunito Sans` is the secondary fallback with slightly more rounded terminals. Import: `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500&family=Nunito+Sans:wght@400;500`

### 3.2 Type Scale

| Element | Font role | Size | Weight | Line Height | Colour |
|---|---|---|---|---|---|
| Page title | Heading (Azo Sans Black) | 24px | 900 | 1.3 | Navy `#1A2332` |
| Section heading | Heading (Azo Sans Black) | 18px | 900 | 1.4 | Navy `#1A2332` |
| Card heading | Heading (Azo Sans Black) | 15px | 900 | 1.4 | Navy `#1A2332` |
| Body | Body (Ingra Regular) | 14px | 400 | 1.6 | Text primary `#1A2332` |
| Secondary / muted | Body (Ingra Regular) | 13px | 400 | 1.5 | Text secondary `#4B5563` |
| Label / caption | Body (Ingra Regular) | 11px | 400 | 1.4 | Text tertiary `#9CA3AF` |
| Monospace / code | Monospace | 13px | 400 | 1.6 | Inherit or Navy |
| Wordmark (large) | Monospace | 28–36px | 500 | 1 | Navy or Cloud |

> Note: Azo Sans Black has a fixed Black weight — do not attempt to simulate other weights of this font. All heading hierarchy is achieved through size variation, not weight variation. Ingra Regular is similarly used at a single weight; do not bold body text.

### 3.3 Adobe Fonts Implementation

Add the Adobe Fonts embed code to the project's `<head>`. This requires an active Adobe Creative Cloud or Adobe Fonts subscription linked to the project domain.

```html
<!-- Adobe Fonts — Gwylio/Post_Watch kit -->
<link rel="stylesheet" href="https://use.typekit.net/ngv5ugr.css">
```

Then reference in CSS:

```css
/* Headings */
font-family: 'azo-sans', 'Archivo Black', 'Montserrat', sans-serif;
font-weight: 900;

/* Body / UI */
font-family: 'ingra', 'Plus Jakarta Sans', 'Nunito Sans', system-ui, sans-serif;
font-weight: 400;
```

If the Adobe Fonts kit ID is not yet available during development, use the Google Fonts fallbacks directly and swap in the Adobe Fonts embed before production deployment.

### 3.4 Rules

- Sentence case throughout. Never Title Case in UI labels, never ALL CAPS in body text.
- Headings use Azo Sans Black only. Never apply heading font to body copy or UI labels.
- Body and UI copy use Ingra Regular only. Never bold body text — use size or colour to create secondary hierarchy instead.
- Module/feature labels rendered in monospace where they use the `post_` naming convention.
- Tagline with `//` prefix always rendered in monospace.

---

## 4. Layout & Structure

### 4.1 App Shell

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (240px, Navy #1A2332)                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Post_Watch wordmark (Mint underscore)            │  │
│  │  by gwylio                                        │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  Navigation (see Section 4.2)                     │  │
│  ├───────────────────────────────────────────────────┤  │
│  │  Client selector (if multi-client)                │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  Main content area (Cloud #F8F9FA background)            │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Top bar: page title + actions                    │  │
│  │  Content                                          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- Sidebar is fixed, 240px wide, Navy background.
- Main content area has Cloud (`#F8F9FA`) background.
- Content max-width: 1200px. Centred within the main area.
- Page-level padding: 24px horizontal, 32px vertical.
- Card gap: 16px.

### 4.2 Navigation Structure

Sidebar navigation items map to the module naming convention:

| Display Label | Module ID | Icon suggestion | Colour accent |
|---|---|---|---|
| Dashboard | `post_status` | grid/overview | Mint |
| ISO 27001 Audit | `post_audit` | clipboard/check | Mint |
| Compliance | `post_comply` | shield/badge | Mint |
| Risk Register | `post_risk` | alert-triangle | Violet |
| Threat Intelligence | `post_intel` | radar/eye | Violet |
| WordPress Security | `post_scan` | wordpress/scan | Mint |
| Alerts | `post_alert` | bell | Ember |
| Reports | `post_report` | file-text | Mint |

Active nav item: Mint left border (3px), Mint text, subtle Mint background fill (`#E6FAF5` equivalent at Navy-adjusted opacity).

### 4.3 Spacing Scale

Use this scale consistently. Do not use arbitrary pixel values.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Tight internal gaps |
| `space-2` | 8px | Icon-to-label gaps, badge padding |
| `space-3` | 12px | Card internal padding (compact) |
| `space-4` | 16px | Card internal padding (standard), grid gaps |
| `space-5` | 24px | Section padding, page horizontal padding |
| `space-6` | 32px | Page vertical padding, large section gaps |
| `space-8` | 48px | Hero/empty state vertical space |

---

## 5. Components

### 5.1 Cards

Standard content container.

```
background: #FFFFFF
border: 0.5px solid #E5E7EB
border-radius: 12px
padding: 20px 24px
```

Card variants:
- **Default**: white background, 0.5px grey border
- **Active/highlighted**: Mint left border accent (3px, `#00D9A3`), white background
- **Alert**: Ember left border accent (3px, `#FF4A1C`), Ember subtle background (`#FFF1EE`)
- **Risk/intel**: Violet left border accent (3px, `#8B5CF6`), Violet subtle background (`#F3F0FF`)

### 5.2 Status Badges

Inline pill badges for compliance/audit states.

| State | Background | Text | Label |
|---|---|---|---|
| Compliant | `#E6FAF5` | `#00B589` | Compliant |
| Partial | `#F3F0FF` | `#7C3AED` | Partial |
| Non-Compliant | `#FFF1EE` | `#CC3A15` | Non-Compliant |
| Not Assessed | `#F3F4F6` | `#9CA3AF` | N/A |
| In Audit | `#EFF6FF` | `#2563EB` | In Progress |

Badge styles:
```
font-size: 11px
font-weight: 500
padding: 3px 8px
border-radius: 4px
font-family: monospace
```

### 5.3 Buttons

| Variant | Background | Text | Border | Usage |
|---|---|---|---|---|
| Primary | `#00D9A3` | `#1A2332` | none | Main CTAs |
| Secondary | transparent | `#1A2332` | `1px solid #E5E7EB` | Secondary actions |
| Danger | `#FF4A1C` | `#FFFFFF` | none | Destructive actions |
| Ghost | transparent | `#4B5563` | none | Tertiary actions |

Button styles:
```
font-size: 14px
font-weight: 500
padding: 8px 16px
border-radius: 8px
cursor: pointer
```

Hover states: Primary button darkens to `#00B589`. Secondary gets `#F8F9FA` fill.

### 5.4 Data Tables

Used for: audit findings, risk registers, scan results.

```
Header row: Navy #1A2332 background, Cloud #F8F9FA text
Body rows: White, alternating with #F9FAFB on hover
Border: 0.5px solid #E5E7EB between rows
Font: 13px body, 11px monospace for IDs/codes
```

Control/clause IDs (e.g. `A.5.1`, `CL-001`) always rendered in monospace.

### 5.5 Metric Cards (Dashboard)

Summary number cards for the status dashboard.

```
background: #FFFFFF
border: 0.5px solid #E5E7EB
border-radius: 12px
padding: 20px

Label: 11px, 500 weight, uppercase, letter-spacing 0.08em, text tertiary
Value: 28px, 500 weight, Navy #1A2332
Sub-label: 12px, text secondary
```

Use Mint for positive metrics, Ember for flagged/alert metrics, Violet for risk scores.

### 5.6 Module Tags

Feature/module identifiers rendered as code-style tags.

```
font-family: monospace
font-size: 12px
color: #00D9A3
background: #1A2332
padding: 4px 10px
border-radius: 4px
```

Examples: `post_audit` `post_scan` `post_intel` `post_report`

---

## 6. Module-Specific Design Notes

### 6.1 post_audit — ISO 27001 Audit

- Clause and control IDs always in monospace: `A.5.1`, `Clause 9.2`
- Finding severity uses the semantic colour system (Mint/Violet/Ember)
- Audit findings displayed as card-per-finding, not grouped
- Evidence status shown as badge inline with finding
- Support for audit cycle view (fortnightly cadence display)

### 6.2 post_comply — Compliance Hub

- SoA (Statement of Applicability) table with inclusion/exclusion toggles
- Gap analysis view: table with status badges and progress bar per domain
- Document register with version, owner, review date columns

### 6.3 post_risk — Risk Register

- Primary accent: Violet (`#8B5CF6`) for risk module chrome
- Risk score rendered as a coloured pill: green < 8, amber 8–15, red > 15
- Risk matrix heatmap component using Mint → Ember gradient scale
- Treatment options as select: Accept / Avoid / Transfer / Mitigate

### 6.4 post_scan — WordPress Security

- Domain/site list as the primary navigation within module
- Scan results categorised: Critical (Ember) / Warning (Violet) / Info (Navy)
- Plugin/theme version table with known CVE badge linking to intel
- Last scan timestamp always visible, monospace format: `2026-04-22 09:14`

### 6.5 post_intel — Threat Intelligence

- Feed-style layout with timestamp-first entries
- MITRE ATT&CK tactic/technique tags in Violet
- Severity indicator left border on feed items
- Source attribution in monospace, muted

### 6.6 post_alert — Alerts

- Full-width alert banner at top of shell for critical alerts (Ember)
- Alert list: newest first, Ember accent for unread
- Dismiss / Acknowledge actions inline

### 6.7 post_report — Client Reports

- Report cover uses Navy background, Mint wordmark, Cloud text
- Section headers use Mint left border accent
- Client name and report date prominent in header
- Rendered output should be print-clean (avoid coloured backgrounds in body content)

---

## 7. Wordmark Rendering

The `Post_Watch` wordmark must be rendered in code, not as an image asset.

### 7.1 Standard (light background)

```html
<span class="wordmark">
  Post<span class="underscore">_</span><span class="watch">Watch</span>
</span>
```

```css
.wordmark {
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 500;
  color: #1A2332;
  letter-spacing: -0.02em;
}
.wordmark .underscore { color: #00D9A3; }
.wordmark .watch { color: #1A2332; opacity: 0.5; }
```

### 7.2 Dark background (sidebar, report cover)

```css
.wordmark { color: #F8F9FA; }
.wordmark .underscore { color: #00D9A3; }
.wordmark .watch { color: #F8F9FA; opacity: 0.5; }
```

### 7.3 Mint background

```css
.wordmark { color: #1A2332; }
.wordmark .underscore { color: #F8F9FA; }
.wordmark .watch { color: #1A2332; opacity: 0.5; }
```

### 7.4 Parent attribution lockup

```html
<div class="brand-lockup">
  <span class="wordmark">Post<span class="underscore">_</span><span class="watch">Watch</span></span>
  <span class="lockup-dot"></span>
  <span class="lockup-parent">a gwylio product</span>
</div>
```

```css
.brand-lockup {
  display: flex;
  align-items: center;
  gap: 10px;
}
.lockup-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #00D9A3;
  flex-shrink: 0;
}
.lockup-parent {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #9CA3AF;
  letter-spacing: 0.04em;
}
```

---

## 8. CSS Custom Properties (Design Tokens)

Implement these as CSS custom properties at `:root`. All component styles should reference tokens, not hardcoded values.

```css
:root {
  /* Brand */
  --color-mint:          #00D9A3;
  --color-mint-muted:    #00B589;
  --color-mint-subtle:   #E6FAF5;
  --color-navy:          #1A2332;
  --color-navy-dark:     #111827;
  --color-violet:        #8B5CF6;
  --color-violet-muted:  #7C3AED;
  --color-violet-subtle: #F3F0FF;
  --color-ember:         #FF4A1C;
  --color-ember-muted:   #CC3A15;
  --color-ember-subtle:  #FFF1EE;
  --color-cloud:         #F8F9FA;

  /* Text */
  --text-primary:   #1A2332;
  --text-secondary: #4B5563;
  --text-tertiary:  #9CA3AF;
  --text-inverse:   #F8F9FA;

  /* Borders */
  --border-default: #E5E7EB;
  --border-strong:  #D1D5DB;

  /* Surfaces */
  --surface-page:    #F8F9FA;
  --surface-card:    #FFFFFF;
  --surface-sidebar: #1A2332;

  /* Typography */
  --font-heading: 'azo-sans', 'Archivo Black', 'Montserrat', sans-serif;
  --font-body:    'ingra', 'Plus Jakarta Sans', 'Nunito Sans', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', 'Courier New', monospace;

  /* Font weights */
  --weight-heading: 900;  /* Azo Sans Black — always 900, never vary */
  --weight-body:    400;  /* Ingra Regular — always 400, never vary */
  --weight-mono:    400;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Borders */
  --border-width: 0.5px;
  --border-radius-card: var(--radius-lg);
  --border-radius-badge: var(--radius-sm);
  --border-radius-button: var(--radius-md);
}
```

---

## 9. Tone of Voice (UI Copy)

- Sentence case always. Never title case in labels or buttons.
- Direct and evidence-led. State what was found, not what might be found.
- No exclamation marks anywhere in the UI.
- Empty states: brief, practical, no cheerful filler copy.
- Error messages: say what happened and what to do next.
- Timestamps: ISO-style `YYYY-MM-DD HH:mm`, rendered in monospace.
- Control/clause references: always exact (`A.5.1`, `Clause 9.2`), always monospace.

### UI copy examples

| Context | ✅ Do | ❌ Don't |
|---|---|---|
| Empty audit list | `No findings recorded for this cycle.` | `You're all clear! 🎉` |
| Scan complete | `Scan complete. 3 issues found.` | `Great news! Your scan finished!` |
| Error | `Failed to load report. Check your connection and try again.` | `Something went wrong.` |
| CTA | `Run scan` | `Run Scan` |
| Nav label | `ISO 27001 audit` | `ISO 27001 Audit` |

---

## 10. Report Output Styling

Client-facing reports generated by `post_report` should follow these rules, separate from app UI styling:

- Cover page: Navy background, Mint wordmark, client name in Cloud, date in Mint monospace
- Body pages: White background, black body text — print-safe
- Section dividers: Mint left border on section headings (3px)
- Finding blocks: Single paragraph per finding, no grouped findings
- Control IDs: Monospace inline, e.g. `A.5.1`
- Status labels: Text only in report body (no coloured badges — print compatibility)
- Footer: `Post_Watch · a gwylio product · [date]` in monospace, muted

---

## 11. File & Naming Conventions

Consistent with the `post_` module convention:

| Asset type | Convention | Example |
|---|---|---|
| Page/route | kebab-case | `/post-audit`, `/post-scan` |
| Component files | PascalCase | `PostAuditFinding.jsx` |
| CSS modules | camelCase | `postAudit.module.css` |
| API endpoints | snake_case | `/api/post_scan/results` |
| Report files | `[client]-[type]-[date]` | `generated-health-audit-2026-04.pdf` |

---

*Post_Watch Design Specification v2.0*
*Produced by Gwylio · Last updated: 2026-04-22*
