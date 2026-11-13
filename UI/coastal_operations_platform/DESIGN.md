---
name: Coastal Operations Platform
colors:
  surface: '#fbf8fb'
  surface-dim: '#dbd9dc'
  surface-bright: '#fbf8fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f5'
  surface-container: '#efedf0'
  surface-container-high: '#eae7ea'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#44474d'
  inverse-surface: '#303032'
  inverse-on-surface: '#f2f0f2'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#515f7a'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#0c1b33'
  on-primary-container: '#7684a1'
  inverse-primary: '#b9c7e6'
  secondary: '#ac3327'
  on-secondary: '#ffffff'
  secondary-container: '#fd6e5c'
  on-secondary-container: '#6d0102'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#001e2c'
  on-tertiary-container: '#008dc0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e3ff'
  primary-fixed-dim: '#b9c7e6'
  on-primary-fixed: '#0c1b33'
  on-primary-fixed-variant: '#394761'
  secondary-fixed: '#ffdad5'
  secondary-fixed-dim: '#ffb4a9'
  on-secondary-fixed: '#410000'
  on-secondary-fixed-variant: '#8a1a12'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7dd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#fbf8fb'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-xxl: 3rem
---

## Brand & Style

This design system establishes a high-performance, dependable administrative environment tailored for hospitality management. The visual language prioritizes operational clarity, data density, and frictionless workflows. 

The aesthetic is grounded in a clean corporate framework using dependable Inter typography and strict functional contrast. It balances structured administrative efficiency with subtle warmth, ensuring long-duration usage remains comfortable for operators managing high-pressure front-desk environments and expansive property inventories.

## Colors

The palette is engineered for a dependable administrative layout with high corporate contrast:
- **Prussian Blue (`#0C1B33`):** The foundational primary color for structural elements, navigation sidebars, and primary text contexts.
- **Vibrant Coral (`#EE6352`):** Applied strictly to urgent operational states, key conversion actions, and primary buttons.
- **Fresh Sky (`#00ABE7`):** Reserved for intelligent features, AI tooling indicators, and interactive data visualization charts.
- **Dust Grey (`#E3DBDB`):** The standard border and divider color ensuring crisp structural separation.
- **Light Grey (`#F6F3F3`):** The clean background canvas tone for the overall application viewport.
- **Pure White (`#FFFFFF`):** Reserved exclusively for elevated cards, modal panels, and input surfaces to create clear visual layering.

## Typography

Typography is systematic, utilitarian, and strictly optimized for legibility in dense operational views. Inter is used across all hierarchies, relying on weight and optical size adjustments rather than decorative font switching. 

- **Headlines:** Semi-bold (600) and medium (500) weights to establish immediate structural hierarchy across dashboards and data tables.
- **Body & Labels:** Regular (400) and medium (500) weights ensuring crisp readability at small scales (12px–14px) for tabular data, metadata, and form inputs.

## Layout & Spacing

The layout utilizes a structured 12-column fluid grid tailored for wide-screen administrative monitors while gracefully scaling down to standard tablet viewports. 

- **Gutters & Margins:** Standardized at 24px (`1.5rem`) for internal column gaps and 32px (`2rem`) for outer canvas margins, maintaining breathable administrative boundaries.
- **Spacing Rhythm:** Built on an 8px baseline grid scale (`space-xs` through `space-xxl`) ensuring predictable spatial relationships between data modules, metric cards, and dense form elements.

## Elevation & Depth

Visual hierarchy is achieved through a combination of crisp structural borders (`#E3DBDB`) and subtle ambient shadows on pure white surfaces. 

- **Base Surfaces:** The application canvas sits at the lowest elevation plane (`#F6F3F3`).
- **Cards & Panels:** Pure white (`#FFFFFF`) containers feature low-opacity, diffused shadows (`0px 4px 12px rgba(12, 27, 51, 0.06)`) to lift interactive regions away from the background without feeling overly dramatic.
- **Modals & Dropdowns:** Elevated surfaces utilize sharper, deeper shadow parameters (`0px 12px 32px rgba(12, 27, 51, 0.12)`) paired with thin border outlines to guarantee clear visual stacking during high-focus tasks.

## Shapes

The design system implements a balanced, semi-rounded geometric language that tempers corporate severity with modern approachability.

- **Containers & Inputs:** Cards, modals, and input fields utilize a 12px radius (`0.75rem`) for a soft, contemporary containment feel.
- **Interactive Elements:** Buttons, tags, and badges feature an 8px radius (`0.5rem`) for quick, clear click targets.
- **Pills:** Fully rounded (9999px) styles are restricted strictly to status indicators, numerical counters, and avatar frames.

## Components

All components inherit the structural tokens defined in previous sections, ensuring total consistency across the administrative suite.

- **Buttons:** Primary actions utilize Vibrant Coral (`#EE6352`) with an 8px radius and high-contrast white text. Secondary actions use neutral ghost borders or clean white fills with Prussian Blue text.
- **Input Fields:** Built with a pure white background, 12px radius, and Dust Grey (`#E3DBDB`) borders. Focus states transition smoothly to Fresh Sky (`#00ABE7`) with a matching subtle ring.
- **Cards:** Pure white rectangular surfaces featuring 12px rounded corners, soft ambient shadows, and optional header dividers for metric summaries or reservation modules.
- **Checkboxes & Radios:** Precision-engineered with clean 2px stroke widths, defaulting to Prussian Blue on selection.
- **Chips & Tags:** Small interactive or descriptive pills featuring an 8px radius, utilized for room statuses, amenity filters, and guest tags.
- **Data Tables:** High-density rows separated by subtle Dust Grey dividers, featuring sticky headers and fixed action columns for rapid property management.