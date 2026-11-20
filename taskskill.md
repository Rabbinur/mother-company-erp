---
name: design-taste-frontend
description: Enforces rigorous design taste, modern art direction, 21st.dev & motion.dev enterprise patterns, and eliminates generic AI-generated template slop in web interfaces.
version: 1.0.0
author: Leon Lin / Antigravity Design System
---

# Design Taste Frontend & Enterprise UI Guidelines (TaskSkill / TasteSkill)

This document establishes the mandatory visual, architectural, and motion design standards for the **Mother Company ERP** and all associated frontend web applications. It enforces rigorous art direction, modern component ergonomics, and cohesive enterprise aesthetics while eliminating generic AI template tropes.

---

## 1. The Three Design Dials

When engineering user interfaces, tune the three foundational parameters:

| Dial | Range | Setting for Mother Company ERP | Explanation |
|---|---|---|---|
| **`DESIGN_VARIANCE`** | 1 – 10 | **4 / 10** | High consistency and predictability for mission-critical ERP operations; clear grid lines, balanced density, and uniform card structures. |
| **`MOTION_INTENSITY`** | 1 – 10 | **3 / 10** | Subtle, snappy, purposeful micro-interactions (150–250ms springs). Zero distracting, slow, or gratuitous page-level animations. |
| **`VISUAL_DENSITY`** | 1 – 10 | **8 / 10** | Information-rich enterprise dashboard density. Compact tables, scannable typography, minimal whitespace wastage, and high data visibility. |

---

## 2. The Nine House Rules

These non-negotiable rules override generic AI frontend defaults:

1. **No Generic AI "Tells" & Tropes**:
   - Never generate centered three-column feature cards with colorful icon circles.
   - Never use cliché warm-beige/terracotta/cream palettes, generic purple gradients, or floating glassmorphism blobs.
   - Never use fake corporate placeholder copy ("Empowering modern businesses with seamless solutions"). Use concise, domain-specific terminology.

2. **Headline Discipline**:
   - Headlines must be **two lines or fewer**.
   - No unnecessary eyebrow badges or redundant tags above every title.
   - Avoid excessive monospace font for non-numerical content. Monospace is reserved exclusively for SKUs, order reference codes, IP addresses, and financial amounts.

3. **Content Edge Alignment**:
   - Maintain strict, pixel-perfect vertical alignment between header, filter toolbars, table edges, and pagination bars.
   - Equal left and right margins across viewports (1440px desktop, 1024px laptop, 768px tablet, 390px mobile).

4. **Purposeful Micro-Interactions**:
   - Linked interactive cards lift **2px** on hover (`hover:-translate-y-0.5 transition-transform duration-150`).
   - Buttons step subtly on hover and press on click (`active:scale-[0.98]`).
   - Tab indicators transition fluidly using Framer Motion `layoutId="activeTab"` with spring physics.
   - No slow, dramatic 3D tilts, auto-sliding carousels, or unrequested scroll-jacking.

5. **Visual Balance & Zero Empty Ground**:
   - Every view must have meaningful content, clear empty-state illustrations, or active skeleton loaders.
   - Never display a blank white box while data is loading. Always render shimmering skeleton wireframes matching the target table rows.

6. **Clear Information Hierarchy & Scannability**:
   - Primary numbers and KPIs must be immediately visible without scrolling.
   - Group related financial balances logically: Acquisition Cost $\le$ Customer Wholesale Price $<$ Suggested Retail Price.
   - Status indicators must use consistent semantic color tokens (Emerald for confirmed/paid, Amber for pending/reserved, Red for cancelled/damaged/overdue).

7. **Data Density for Operations**:
   - High data-to-pixel ratio: tabular rows should be compact (36px to 44px height).
   - Use right-aligned numeric columns for financial amounts and quantities to enable effortless mental math.

8. **Accessible Form Ergonomics**:
   - Form fields must feature clear labels, required asterisks (`*`), contextual helper text, and inline validation error messages.
   - Modal dialogs must support keyboard accessibility (`Escape` key close, auto-focus, backdrop click dismissal).

9. **Verification Gate**:
   - Automated visual and build inspection must pass: zero overlapping text, zero horizontal page overflow, clean contrast ratios ($> 4.5:1$ for normal text), and valid TypeScript compilation.

---

## 3. Enterprise ERP Design System

### 3.1 Color Palette & Token Architecture
```css
/* Core Neutral Palette */
--background: #f8fafc;        /* slate-50 */
--surface: #ffffff;           /* pure white */
--border: #e2e8f0;            /* slate-200 */
--border-subtle: #f1f5f9;     /* slate-100 */

/* Typography */
--text-primary: #0f172a;      /* slate-900 */
--text-secondary: #475569;    /* slate-600 */
--text-muted: #94a3b8;        /* slate-400 */

/* Primary Brand Accent */
--primary: #0284c7;           /* sky-600 */
--primary-hover: #0369a1;     /* sky-700 */
--primary-subtle: #f0f9ff;    /* sky-50 */

/* Semantic Status Tokens */
--success-text: #047857;      /* emerald-700 */
--success-bg: #ecfdf5;        /* emerald-50 */
--warning-text: #b45309;      /* amber-700 */
--warning-bg: #fffbeb;        /* amber-50 */
--danger-text: #b91c1c;       /* red-700 */
--danger-bg: #fef2f2;         /* red-50 */
--info-text: #0369a1;         /* sky-700 */
--info-bg: #f0f9ff;           /* sky-50 */
```

### 3.2 Typography Standards
- **Font Family**: Inter or system-ui sans-serif with tabular numerical lining (`font-mono` for amounts, SKUs, and vouchers).
- **Scale**:
  - Page Title: `text-xl` or `text-2xl font-bold tracking-tight text-slate-900`
  - Section Header: `text-sm font-semibold text-slate-900`
  - Table Header: `text-[11px] font-semibold uppercase tracking-wider text-slate-500`
  - Table Body: `text-xs text-slate-700`
  - Metadata / Code: `text-[10px] font-mono text-slate-400`

---

## 4. 21st.dev & Motion.dev Component Standards

### 4.1 Header Dealership Switcher
- **Pattern**: An interactive dropdown in the top header displaying the active dealership logo/badge (e.g. `Fresh Distribution`, `PRAN Foods`, `ACI Consumer Goods`) with a global `Consolidated (All Dealerships)` view for Super Admins.
- **Visual**: Rounded-lg border, active dealership pill indicator, keyboard navigation.

### 4.2 Multi-Stage Workflow Steppers
- **Pattern**: Used in warehouse loading/unloading and daily deliveryman runs:
  $$\text{1. Morning Loading} \longrightarrow \text{2. Route Delivery} \longrightarrow \text{3. Return Collection} \longrightarrow \text{4. Day-End Reconciliation}$$
- **Visual**: Connected step pills with icons, checkmark completion states, and progress line fill.

### 4.3 Command Palette (`Cmd + K` / `Ctrl + K`)
- **Pattern**: Instant keyboard shortcut trigger opening a blurred modal spotlight.
- **Search Scope**: Search across Retailers, Invoices, Deliverymen, Products, and Quick Navigation links.

### 4.4 Motion.dev Animation Specifications
- **Framer Motion Config**:
  ```typescript
  export const smoothSpring = {
    type: "spring",
    stiffness: 400,
    damping: 30,
  };

  export const tabIndicatorTransition = {
    type: "spring",
    bounce: 0.2,
    duration: 0.3,
  };
  ```
- **Tab Indicators**:
  ```tsx
  {isActive && (
    <motion.div
      layoutId="activeTabIndicator"
      className="absolute inset-0 rounded-lg bg-white shadow-xs"
      transition={tabIndicatorTransition}
    />
  )}
  ```

---

## 5. Finish Gate Checklist

Before declaring any UI page or component complete:
- [ ] No layout shifts or text wrapping collisions on screen resize ($390\text{px}$ to $1920\text{px}$).
- [ ] Skeletons accurately mimic the loaded data layout.
- [ ] Number columns are right-aligned and formatted with Bangladesh Currency (`৳ BDT`).
- [ ] All clickable interactive elements have visible `:hover`, `:active`, and `:focus-visible` outlines.
- [ ] Confirms to strict SOLID principles and reusable component architecture.
