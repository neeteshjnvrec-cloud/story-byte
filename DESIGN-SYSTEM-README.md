# StoryByte Design System Summary

## Overview
Complete design system for StoryByte — an audio storytelling app with daily AI-generated stories. This document captures the design decisions and specifications derived from deep research into audio app UX patterns.

## Key Design Decisions

### Color Philosophy
*"Twilight storytelling"* — the palette draws from the moods of evening storytelling:
- **Primary accent**: `#667eea` (indigo) — evokes calm focus, ideal for audio consumption
- **Secondary**: `#ec4899` (pink) — adds narrative energy for interactive elements
- **Tertiary**: `#8b5cf6` (purple) — supports genre diversity with character
- **Dark theme**: `#0a0a0a` ground with `#1a1a1a` surfaces creates depth for media consumption
- **Light theme**: Clean `#ffffff` with subtle `#f8f9fa` surfaces for daytime reading

### Typography
System fonts (SF Pro / Roboto) for native performance — critical for a mobile-first app.
- **Display**: 36px / 700 weight — screen titles demand attention
- **Body**: 16px / 400 — optimal line length for story descriptions
- **Micro**: 11px / 600 — metadata needs precision in tight spaces

### Layout Concept
*"Immersive media consumption"* — the layout prioritizes the story experience:
- Full-width cover images (16:9 ratio) create immediate visual impact
- Content hierarchy flows: Visual → Title → Meta → Actions → Playback
- Collapsible player bar stays anchored at bottom for persistent access
- Spacing follows 4px grid for consistent rhythm

## Screens Inventory (12 total)

### Auth Flow (3 screens)
1. **Login** — Gradient background, glass inputs, divider with "or"
2. **Signup** — 4-field form (name, email, password, confirm)
3. **ForgotPassword** — Single email input + reset button

### Main App (5 screens)
4. **Home** — Story feed with category/language filters
5. **Search** — Genre-based discovery with chips grid
6. **StoryDetail** — Cover, play, progress, rating, story text
7. **Favorites** — Saved stories list with empty state
8. **Profile** — User stats, listening history, settings

### Modals (2 screens)
9. **ExpandedPlayer** — Full audio control with text card
10. **Settings** — Theme toggle, language, notifications

### Future (2 screens)
11. **Onboarding** — 3-page walkthrough for new users
12. **ListeningHistory** — Detailed playback log

## Component Specs

| Component | Height | Border Radius | Notes |
|-----------|--------|---------------|-------|
| Primary Button | 48px | 16px | Gradient background |
| Secondary Button | 48px | 16px | Transparent/surface |
| Story Card | ~250px | 12px | 180px image + content |
| Search Bar | 50px | 12px | Icon + input |
| Genre Chip | 40px | 20px | Icon + label, selectable |
| Player Bar (collapsed) | 64px | 16px | Fixed bottom |
| Player (expanded) | Full screen | Modal | Slide-up animation |

## Navigation Structure
```
App
├─ AuthStack (no header)
│  ├─ Login
│  ├─ Signup
│  └─ ForgotPassword
├─ TabNavigator
│  ├─ Home (🏠)
│  ├─ Search (🔍)
│  ├─ Favorites (❤️)
│  └─ Profile (👤)
├─ StoryDetail (modal)
└─ ExpandedPlayer (modal)
```

## Figma Handoff Specifications

### File Pages
1. **Design System** — Colors, Typography, Spacing, Shadows, Icons, Tokens
2. **Components** — All reusable components with states (default/hover/active/disabled)
3. **Screens** — Complete screen designs with annotations

### Auto-Layout Specs
- **Story Card**: Vertical stack, 16px padding, 12px radius
- **Genre Chip**: Horizontal stack, 20px radius, 10px horizontal padding
- **Button**: Horizontal stack, 16px radius, 24px min padding
- **Filter Bar**: Horizontal scroll, 16px gap

### Export Checklist
- [ ] All color tokens as CSS variables
- [ ] Typography styles (36→28→20→16→14→12→11 px)
- [ ] Spacing scale (4, 8, 16, 24, 32, 48)
- [ ] Border radius presets (8, 12, 16, 24, full)
- [ ] Shadow presets (sm, md, lg)
- [ ] Component variants (all states documented)
- [ ] Icon set (emoji-based, size specs)
- [ ] Screen templates (with scrollable areas marked)

## Next Steps

### Immediate (Figma)
1. Create new Figma file with recommended page structure
2. Implement color styles from token table
3. Set up typography styles with SF Pro
4. Build component library with variants
5. Design 3 auth screens using gradient backgrounds

### Short-term (Development)
1. Add `divider` color to theme tokens
2. Verify all hard-coded colors in search screen use theme tokens
3. Add waveform display to player (audio visualization)
4. Implement theme toggle in Settings screen

### Research Insights
- **Audio apps**: Users value persistent playback controls (seen in Spotify, Audible, Pocket Casts)
- **Storytelling apps**: Genre discovery is critical (Clubhouse used genre-based rooms)
- **Dark mode**: Media consumption apps benefit significantly from dark themes (reduces eye strain)
- **Typography**: Sans-serif system fonts preferred for accessibility and performance