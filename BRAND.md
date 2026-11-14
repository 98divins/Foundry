# Foundry — visual identity

A mix of three directions: **forged metal** (the name, the logo, copper), **sports energy**
(cobalt, wide numbers) and **lab precision** (technical text face, tight radii, hairlines).

## Logo

An **ingot** — the bar a foundry casts — with an **F** cut out of it, and a small **copper spark**.
It says what the app does: you forge yourself, in training and in the kitchen.

- App icon: white ingot on cobalt `#2443F2`, F in negative space, copper spark `#E08A4C` (`public/icon.svg`).
- In the app: the ingot takes the accent colour and the F the page background (`Logo` in `src/components/ui.tsx`).
- Wordmark: FOUNDRY in Archivo ExtraBold, wide (118 %), slight tracking.
- Keep clear space of half the ingot height around the mark. Do not rotate, outline or recolour the spark.

## Colour

| Role | Dark | Light |
| --- | --- | --- |
| Background | `#0D1015` | `#F3F5F8` |
| Surface | `#151A21` | `#FFFFFF` |
| Text | `#EEF1F5` | `#10141A` |
| Muted text | `#8E98A6` | `#5D6775` |
| **Cobalt** (actions, focus, data) | `#3D5BFF` | `#2443F2` |
| **Copper** (records, trophies, check-ins only) | `#E08A4C` | `#B5622A` |
| Success / danger | `#2FBF86` / `#F05656` | `#138A5C` / `#D63939` |

Macros: protein `#F0628A`, carbs `#F2B33D`, fat `#22B8CF`. Copper is never used for buttons:
it stays rare so a record feels like one.

## Type

- **Archivo** (Google Fonts) for titles and big numbers: ExtraBold, sentence case, slightly tight;
  numbers in the wide cut (112 %).
- **IBM Plex Sans** for everything else; small labels in caps with letter-spacing.

## Shape

- Radius 12 px for cards, 8 px for buttons; 1 px hairline borders.
- **Signature:** primary buttons have a 10 px cut top-right corner, like a stamped metal tag.
  Use it on one main action per screen.
