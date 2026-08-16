# StoryByte Figma Design System Guide

## 📐 Getting Started

This guide provides all the information needed to recreate the StoryByte design in Figma.

## 🎨 Color Tokens

### Primary Palette
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `color.primary` | `#667eea` | `#667eea` | Primary buttons, accents |
| `color.secondary` | `#ec4899` | `#ec4899` | Secondary actions, highlights |
| `color.tertiary` | `#8b5cf6` | `#8b5cf6` | Tertiary elements |
| `color.success` | `#10b981` | `#10b981` | Success states |
| `color.warning` | `#f59e0b` | `#f59e0b` | Warning states |
| `color.error` | `#ef4444` | `#ef4444` | Error states |

### Light Theme
| Token | Value |
|-------|-------|
| `color.background` | `#ffffff` |
| `color.surface` | `#f8f9fa` |
| `color.text` | `#1a1a1a` |
| `color.textSecondary` | `#666666` |
| `color.border` | `#e0e0e0` |
| `color.divider` | `#e0e0e0` |

### Dark Theme
| Token | Value |
|-------|-------|
| `color.background` | `#0f0f0f` |
| `color.surface` | `#1a1a1a` |
| `color.text` | `#ffffff` |
| `color.textSecondary` | `#b0b0b0` |
| `color.border` | `#2a2a2a` |
| `color.divider` | `#2a2a2a` |

### Gradient
| Token | Value |
|-------|-------|
| `gradient.primary` | `#667eea` → `#764ba2` |
| `gradient.secondary` | `#ec4899` → `#8b5cf6` |

## 🔤 Typography Scale

| Style | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 36px | 700 | 44px | Screen titles |
| `heading1` | 32px | 700 | 40px | Page titles |
| `heading2` | 24px | 600 | 32px | Section titles |
| `heading3` | 20px | 600 | 28px | Card titles |
| `body` | 16px | 400 | 24px | Body text |
| `caption` | 14px | 400 | 20px | Helper text |
| `micro` | 12px | 600 | 16px | Metadata |
| `button` | 16px | 600 | 24px | Button text |

**Font Family**: System fonts (SF Pro Display for iOS, Roboto for Android)

## 📏 Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `spacing.xs` | 4px | Tight gaps |
| `spacing.sm` | 8px | Small gaps |
| `spacing.md` | 16px | Standard gaps |
| `spacing.lg` | 24px | Large gaps |
| `spacing.xl` | 32px | Section spacing |
| `spacing.2xl` | 48px | Major spacing |

## 🎯 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius.sm` | 8px | Small elements |
| `radius.md` | 12px | Cards, inputs |
| `radius.lg` | 16px | Buttons, modals |
| `radius.xl` | 24px | Large containers |
| `radius.full` | 9999px | Pills, avatars |

## 🧩 Component Specs

### Button
- **Height**: 48px
- **Padding**: 24px horizontal
- **Radius**: 24px (pill)
- **Shadow**: 0 4px 12px rgba(102, 126, 234, 0.3)
- **States**: Default, Hover, Active, Disabled, Loading

### Input Field
- **Height**: 48px
- **Padding**: 14px 16px
- **Radius**: 12px
- **Background**: `rgba(255, 255, 255, 0.05)` (dark), `#f8f9fa` (light)
- **Border**: 1px `rgba(255, 255, 255, 0.1)` (dark), `#e0e0e0` (light)
- **Focus**: Border color `color.primary`, shadow glow

### Story Card
- **Image**: 180px height, 16:9 ratio
- **Radius**: 12px
- **Padding**: 16px
- **Shadow**: 0 2px 8px rgba(0,0,0,0.1)
- **Duration Badge**: Absolute positioned, bottom-right

### Genre Chip
- **Height**: 40px
- **Radius**: 20px
- **Padding**: 10px 16px
- **Icon + Label** layout

### Avatar
- **Sizes**: 32px (sm), 48px (md), 64px (lg)
- **Radius**: 50% (circle)
- **Background**: Primary gradient

### Bottom Navigation
- **Height**: 64px
- **Background**: `color.surface`
- **Border**: 1px top `color.divider`
- **Icon + Label** layout
- **Active state**: `color.primary`

## 📱 Screen Layouts

### Login Screen
```
┌─────────────────────────┐
│                         │
│        📚               │  (Logo circle)
│                         │
│    Welcome Back         │  (heading1)
│  Sign in to continue    │  (caption)
│                         │
│  ┌─────────────────┐    │
│  │ Email           │    │  (input)
│  └─────────────────┘    │
│  ┌─────────────────┐    │
│  │ Password 🔒     │    │  (input)
│  └─────────────────┘    │
│                         │
│      [Sign In]          │  (button)
│                         │
│  Forgot Password?       │  (caption)
│                         │
│  ─────── or ───────     │  (divider)
│                         │
│  [Create Account]       │  (button)
│                         │
└─────────────────────────┘
```

### Home Screen
```
┌─────────────────────────┐
│ StoryByte      ⚙️       │  (header)
│ Your daily dose...      │
│                         │
│ [All] [EN] [HI]         │  (language chips)
│                         │
│ Categories              │  (section title)
│ [Fantasy ⚔️ 24]         │  (scrollable chips)
│ [Mystery 🔍 18]         │
│                         │
│ Latest Stories          │  (section title)
│ ┌─────────────────┐     │
│ │ [Image 180px]   │     │  (story card)
│ │ Title           │     │
│ │ [Fantasy] [EN]  │     │
│ └─────────────────┘     │
│                         │
│ 🏠 🔍 ❤️ 👤             │  (bottom nav)
└─────────────────────────┘
```

### Story Detail Screen
```
┌─────────────────────────┐
│                         │
│    [Image 100% width]   │  (cover)
│                         │
│  ┌─────────────────┐    │
│  │ The Last        │    │  (card overlay)
│  │ Storyteller     │    │
│  │ Fantasy • 8:45  │    │
│  │                 │    │
│  │ [▶ Play]        │    │
│  │ ⭐ 4.8 ▶ 2.3K   │    │
│  └─────────────────┘    │
│                         │
│  Story text preview...  │
│                         │
└─────────────────────────┘
```

### Audio Player (Expanded)
```
┌─────────────────────────┐
│ ▼  The Last Storyteller │  (header)
│                         │
│ ┌─────────────────┐     │
│ │ Page 1 / 3      │     │  (text card)
│ │ In the beginning │    │
│ │ of silence...    │     │
│ └─────────────────┘     │
│                         │
│ ██░░░░░░░░░░░░░░░░░░░  │  (progress)
│ 2:15         6:30      │
│                         │
│ ⏮ ⏪ ▶ ⏩ ⏭            │  (controls)
│                         │
│ [1x] ━━━━━━━ 🔊        │  (secondary)
│                         │
└─────────────────────────┘
```

## 🎭 States & Variants

### Button States
| State | Background | Text | Shadow |
|-------|-----------|------|--------|
| Default | Gradient | White | 0 4px 12px |
| Hover | Gradient +10% brightness | White | 0 6px 16px |
| Active | Gradient -10% brightness | White | 0 2px 4px |
| Disabled | Gray 50% | White 50% | None |
| Loading | Gradient | Spinner | 0 4px 12px |

### Input States
| State | Background | Border | Text |
|-------|-----------|--------|------|
| Default | 5% white | 10% white | Primary |
| Focus | 5% white | Primary | Primary |
| Error | 5% white | Error red | Error red |
| Disabled | 3% white | 10% gray | Secondary |

### Card States
| State | Shadow | Transform |
|-------|--------|-----------|
| Default | 0 2px 8px rgba(0,0,0,0.1) | None |
| Hover | 0 8px 16px rgba(0,0,0,0.15) | translateY(-4px) |
| Active | 0 4px 8px rgba(0,0,0,0.1) | translateY(0) |

## 📐 Auto-Layout Specs

### Story Card
```
Container (Vertical, Padding: 16)
├── Image (Width: 100%, Height: 180)
│   └── Duration Badge (Absolute, Bottom: 10, Right: 10)
├── Content (Padding: 16)
│   ├── Title (Size: 18, Weight: 600)
│   ├── Description (Size: 14, Weight: 400)
│   └── Meta (Horizontal, Gap: 8)
│       ├── Tags (Horizontal, Gap: 8)
│       └── Plays (Size: 12)
```

### Genre Chip
```
Container (Horizontal, Padding: 10 16, Radius: 20)
├── Icon (Size: 16)
└── Label (Size: 14, Weight: 600)
```

### Button
```
Container (Horizontal, Padding: 14 24, Radius: 24)
├── Loading Spinner (if loading)
├── Icon (if present)
└── Label (Size: 16, Weight: 600)
```

## 🎨 Design Layers

### Figma File Structure
```
📁 StoryByte Design System
├── 📄 Cover (App Icon)
├── 📄 Color System
│   ├── Primary Palette
│   ├── Light Theme
│   ├── Dark Theme
│   └── Gradients
├── 📄 Typography
│   ├── Display
│   ├── Headings
│   ├── Body
│   └── Captions
├── 📄 Spacing & Radius
├── 📄 Components
│   ├── Buttons
│   │   ├── Primary
│   │   ├── Secondary
│   │   └── Ghost
│   ├── Inputs
│   │   ├── Default
│   │   ├── With Icon
│   │   └── Error State
│   ├── Cards
│   │   ├── Story Card
│   │   ├── Stats Card
│   │   └── Skeleton
│   ├── Chips
│   │   ├── Genre Chip
│   │   └── Filter Chip
│   ├── Navigation
│   │   ├── Bottom Tab
│   │   └── Header
│   └── Feedback
│       ├── Toast
│       ├── Loading
│       └── Empty State
├── 📄 Screens
│   ├── Auth
│   │   ├── Login
│   │   ├── Signup
│   │   └── Forgot Password
│   ├── Main
│   │   ├── Home
│   │   ├── Search
│   │   ├── Favorites
│   │   └── Profile
│   └── Modals
│       ├── Story Detail
│       ├── Player
│       └── Settings
└── 📄 Components Library (Symbols)
```

## 🔄 Usage Guidelines

### When to Use Primary Button
- Main call-to-action on a screen
- Login/Signup actions
- Play story action
- Confirm destructive actions

### When to Use Secondary Button
- Alternative actions
- Navigation to related screens
- Cancel/back actions
- Less important CTAs

### When to Use Ghost Button
- Icon-only buttons
- Settings/preferences
- Compact spaces
- Tertiary actions

### Input Best Practices
- Always show placeholder text
- Use icons for visual cues (email, password)
- Provide validation feedback
- Support secure text entry for passwords
- Auto-capitalize appropriately (none for email/password)

### Card Interaction
- Tap to navigate to detail
- Long press for actions menu
- Swipe left for quick actions (favorite)
- Pull to refresh on list views

## 📦 Export Specifications

### Icons
- Format: PNG, SVG
- Sizes: 24x24, 32x32, 48x48, 64x64
- Style: Emoji-based for simplicity
- Export: 2x, 3x for Retina

### Images
- Cover images: 400x300 (4:3 ratio)
- Format: WebP for web, PNG for mobile
- Compression: Medium quality (80%)

### Components
- Export as Symbols/Components in Figma
- Use Auto-Layout for all interactive elements
- Document all variants and states

## 🎯 Accessibility

### Color Contrast
- Minimum contrast ratio: 4.5:1 for normal text
- Minimum contrast ratio: 3:1 for large text
- Test both light and dark themes

### Touch Targets
- Minimum: 44x44px (iOS HIG)
- Recommended: 48x48px
- Adequate spacing between interactive elements

### Dynamic Type
- Support iOS Dynamic Type sizes
- Test at 200% text scaling
- Ensure layouts don't break at larger sizes

### VoiceOver
- All interactive elements must be accessible
- Provide descriptive labels
- Announce state changes (loading, success, error)

## 📝 Developer Handoff Notes

### CSS Variables
```css
:root {
  --color-primary: #667eea;
  --color-secondary: #ec4899;
  --color-text: #1a1a1a;
  --color-text-secondary: #666666;
  --spacing-md: 16px;
  --radius-lg: 16px;
}
```

### React Native Style Sheets
```javascript
const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 24,
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
});
```

### Thematic Usage
- Use theme tokens, not hardcoded colors
- Support both light and dark modes
- Ensure accessibility contrast ratios

## ✅ Verification Checklist

- [ ] All colors match design tokens
- [ ] Typography scale implemented correctly
- [ ] Spacing follows 4px grid
- [ ] Border radius values are correct
- [ ] All component states designed
- [ ] Dark mode versions created
- [ ] Touch targets are minimum 44x44px
- [ ] Icons are consistent style
- [ ] Auto-layout configured properly
- [ ] Components exported as symbols

---

*Created for StoryByte v1.0*
*Design System Version: 1.0*
*Last Updated: 2024*
