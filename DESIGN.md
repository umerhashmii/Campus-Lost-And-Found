# Unified UBIT Claymorphism Design System (DESIGN.md)
## Department of Computer Science (UBIT) — University of Karachi

* **Framework:** TypeUI Claymorphism (`npx typeui.sh pull claymorphism`)
* **Institutional Brand:** Department of Computer Science (UBIT), University of Karachi (`Ubit Logo.jpg`)
* **Mission:** A tactile, friendly, accessible, and authoritative academic platform combining soft claymorphic 3D surfaces with official UBIT crimson and gold prestige.

---

## 1. Design Philosophy & Aesthetic Fusion

```text
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│     TYPEUI CLAYMORPHISM         │   +    │      UBIT OFFICIAL IDENTITY      │
│ • Soft, rounded 3D clay volumes │        │ • Official Academic Maroon/Seal  │
│ • Double shadows (outer + inset)│        │ • Academic Gold Accent Star      │
│ • Poppins & Montserrat typography│       │ • Official DCS Department Emblem │
└─────────────────────────────────┘        └──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       UNIFIED UBIT CLAYMORPHISM                             │
│   Touchable, puffy, friendly card surfaces anchored by prestigious academic  │
│   maroon and gold hierarchy, meeting strict WCAG 2.2 AA accessibility.      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Color Palette & Semantic Tokens

### A. Core Brand Tokens (Blended with Ubit Logo.jpg)
* **`--color-primary` (`#7A1521`):** Official UBIT Academic Maroon. Used for primary CTAs, active states, key navigation highlights, and institutional headers.
* **`--color-primary-hover` (`#8F1D2C`):** Vibrant interactive crimson.
* **`--color-primary-dark` (`#4A0D14`):** Deep shadow contour and border contrast.
* **`--color-primary-soft` (`#FDF2F4`):** Soft maroon surface wash for badges and active pills.
* **`--color-accent-gold` (`#D4AF37`):** UBIT Prestige Gold from the logo star. Used for verified badges, high-confidence match highlights, and star ratings.
* **`--color-accent-gold-soft` (`#FEF9EE`):** Warm gold pill surface.

### B. Canvas, Clay Surfaces & Backgrounds
* **`--color-canvas` (`#F3F5FA`):** Soft, cool clay canvas that allows white puffy elements to float naturally.
* **`--color-surface` (`#FFFFFF`):** Base white surface for clay cards and dialogs.
* **`--color-surface-soft` (`#F8F9FD`):** Recessed well surface for forms and search bars.
* **`--color-surface-card` (`#FFFFFF`):** High-elevation clay cards.

### C. Text & Contrast Tokens (WCAG 2.2 AA Compliant)
* **`--color-text-main` (`#1A1D2E`):** Deep navy-charcoal for headings and strong body copy (> 9:1 contrast ratio against white/canvas).
* **`--color-text-body` (`#333A4D`):** Balanced, high-legibility copy.
* **`--color-text-muted` (`#6B7280`):** Secondary descriptions and timestamp metadata.
* **`--color-text-inverse` (`#FFFFFF`):** Text over dark maroon or primary buttons.

### D. Semantic Alert & Status Tokens
* **`--color-success` (`#16A34A`):** Matched / Claim Approved / Recovered status.
* **`--color-success-soft` (`#F0FDF4`):** Green clay pill.
* **`--color-warning` (`#D97706`):** Pending Review / In-Custody warning.
* **`--color-warning-soft` (`#FFFBEB`):** Yellow clay pill.
* **`--color-danger` (`#DC2626`):** Rejected / Conflict / Error alerts.
* **`--color-danger-soft` (`#FEF2F2`):** Red clay pill.

---

## 3. Claymorphic Lighting, Shadows & Depth

The signature clay look is achieved via **layered outer drop shadows** paired with **subtle inset highlights**:

```css
/* Standard Interactive Clay Card */
--clay-card-shadow: 
  0 10px 25px -5px rgba(26, 29, 46, 0.08),
  0 8px 10px -6px rgba(26, 29, 46, 0.04),
  inset 0 2px 3px rgba(255, 255, 255, 0.8),
  inset 0 -2px 3px rgba(122, 21, 33, 0.05);

/* Hover State (Inflates slightly) */
--clay-card-hover: 
  0 16px 32px -6px rgba(26, 29, 46, 0.12),
  0 10px 14px -6px rgba(26, 29, 46, 0.06),
  inset 0 2px 4px rgba(255, 255, 255, 0.9);

/* Primary Maroon Clay Button */
--clay-btn-primary:
  0 8px 18px -4px rgba(122, 21, 33, 0.35),
  inset 0 2px 3px rgba(255, 255, 255, 0.3),
  inset 0 -2px 4px rgba(74, 13, 20, 0.4);

/* Pressed / Active State */
--clay-btn-active:
  0 2px 6px -1px rgba(122, 21, 33, 0.4),
  inset 0 3px 6px rgba(0, 0, 0, 0.25);
```

---

## 4. Typography Foundations

* **Display & Headings:** `Poppins`, sans-serif (Weights: 600 SemiBold, 700 Bold, 800 ExtraBold).
  * Rounded letterforms that perfectly mirror clay volume.
* **Body Copy & Interfaces:** `Montserrat`, sans-serif (Weights: 400 Regular, 500 Medium, 600 SemiBold).
  * Crisp geometry, tall x-height, readable across both desktop and mobile screens.
* **Monospace / System Tags:** `JetBrains Mono`, monospace.
  * Used for Enrollment IDs (`EB25210006105`), Voucher Codes (`UBIT-REC-0001`), and Stored Procedure names.

---

## 5. Spacing, Radii & Layout Structure

* **Border Radii:**
  * Pill Controls: `9999px` (Badges, user switchers, tab buttons)
  * Cards & Modals: `24px` (Rounded clay tablets)
  * Form Inputs & Buttons: `14px`
* **Spacing Scale:**
  * `4px` · `8px` · `12px` · `16px` · `24px` · `32px` · `48px` · `64px`
* **Container Width:** Max `1200px` centered with responsive fluid gutters (`16px` mobile, `32px` desktop).

---

## 6. Official Multi-Page Site Navigation Architecture

The site operates as a unified official portal with 6 clear, guided pages:

1. **🏛️ Home Hub (`view-home`):**
   * Department banner with official seal.
   * Clear value proposition: *"Lost an item in a lab? Found property on campus?"*
   * 4 Quick-Action Clay Cards (Report Lost, Report Found, Browse Directory, Security Desk).
   * Live Campus Activity Ticker & Real-time Recovery Stats.
   * "How It Works" 3-step student orientation.
2. **🔍 Browse Directory (`view-catalog`):**
   * Search-as-you-type directory of all reported items.
   * Filter by Category (ID Cards, Electronics, Bags, Books, USBs).
   * Filter by Department Location (Software Lab, Library, Canteen, Auditorium).
3. **📝 Report Lost Item (`view-file-lost`):**
   * Guided multi-step form with clear instructions and instant matching trigger.
4. **📦 Report Found Item (`view-file-found`):**
   * Simple intake for honest finders and lab attendants.
5. **⚡ Smart Matches (`view-matches`):**
   * 4-factor scoring breakdown with interactive transparency explainer.
6. **🛡️ Security & Custody Desk (`view-security`):**
   * Officer verification queue, concurrency lock simulator, and official printable handover vouchers with department seal.
7. **📊 Analytics & Recovery Insights (`view-analytics`):**
   * Category recovery rate meters and campus spatial incident density.
