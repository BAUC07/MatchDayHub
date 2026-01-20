# Design Guidelines: Grassroots Football Match Logger

## 1. Brand Identity

**Purpose**: Pitch-side match logging tool for grassroots football managers—reliable, fast, pressure-tested.

**Aesthetic Direction**: **Stadium Bold**
- High-contrast, referee-inspired design
- Pitch green accents on dark surfaces
- Clear, unapologetic hierarchy
- Industrial-strength reliability
- Zero decorative fluff—every element earns its place

**Memorable Element**: The live match screen's fixed three-zone layout with pitch visualization—instantly recognizable, zero scrolling, built for gloved hands in the rain.

## 2. Navigation Architecture

**Root Navigation**: Tab Bar (3 tabs)
- **Teams** (home icon) - Team & squad management
- **Matches** (list icon) - Match history & create new match
- **Settings** (gear icon) - Subscription, preferences, profile

**Screen Hierarchy**:
- Teams → Team Detail → Squad Editor
- Matches → Match Setup → Live Match → Match Summary
- Settings → Profile, Subscription

## 3. Screen-by-Screen Specifications

### Teams Screen
- **Purpose**: View/manage teams (1 for free, unlimited for paid)
- **Layout**: 
  - Transparent header with "+ Add Team" button (right, disabled if free + 1 team exists)
  - Scrollable card list of teams
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Team cards (name, last match date, record), empty state if no teams
- **Empty State**: Illustration (empty-teams.png) with "Create Your First Team"

### Team Detail Screen
- **Purpose**: View squad, start match
- **Layout**:
  - Default header with back button, team name title
  - Scrollable content: squad list grouped (Starting/Subs/Unavailable)
  - Floating action button: "Start Match" (bottom right)
  - Top inset: Spacing.xl
  - Bottom inset: tabBarHeight + 80 (for FAB)
- **Components**: Player list items (name, number, drag handle), edit squad button (header right)

### Match Setup Screen
- **Purpose**: Pre-match configuration
- **Layout**:
  - Default header with back, "Match Setup" title, "Next" button (right, disabled until valid)
  - Scrollable form: opposition name input, location picker (Home/Away), format picker (5v5/7v7/9v9/11v11), starting lineup selector (drag-drop)
  - Top inset: Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Text input, segmented controls, draggable player chips

### Live Match Screen (CRITICAL - NO SCROLL)
- **Purpose**: Real-time event logging
- **Layout**: Fixed three-zone vertical split
  1. **Top Bar (15% height)**: Score (YOURS - OPP), match clock (MM:SS format, +added time indicator), pause/play button (requires long-press)
  2. **Middle Zone (60% height)**: Simplified pitch diagram (green rectangle), on-pitch players (circles with numbers), bench strip below pitch (horizontal scrollable if needed)
  3. **Bottom Action Bar (25% height)**: 5 large buttons in grid: GOAL+, GOAL-, CARD, SUB, PENALTY
- **Safe Area**: Full screen, ignores tab bar. Top inset: insets.top, Bottom inset: insets.bottom
- **Interaction**: Tap player → action sheet (Goal, Assist, Card, Sub off). Tap action button → bottom sheet for details.
- **Timeline Access**: Small list icon (top right of Top Bar) opens bottom sheet overlay

### Match Summary Screen
- **Purpose**: Post-match review
- **Layout**:
  - Default header with "Match Summary" title, "Done" button (right)
  - Scrollable content: final score card, horizontal timeline (time axis with event icons), stats summary
  - Top inset: Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Score display, timeline visualization, event list

### Settings Screen
- **Purpose**: Profile, subscription, preferences
- **Layout**:
  - Transparent header with "Settings" title
  - Scrollable list: Profile card (avatar, name), Subscription status (upgrade button if free), Theme toggle, About
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- **Components**: Avatar (profile-avatar-1.png), list items, upgrade CTA card

## 4. Color Palette

**Primary**: Pitch Green `#00A86B` (stadium grass, used for key actions)
**Secondary**: Referee Black `#1A1A1A` (authority, seriousness)
**Accent**: Warning Yellow `#FFD700` (cards, alerts)
**Danger**: Red Card `#DC143C` (destructive actions)

**Backgrounds**:
- Dark: `#0D0D0D` (main background)
- Surface: `#1F1F1F` (cards, modals)
- Elevated: `#2A2A2A` (buttons, inputs)

**Text**:
- Primary: `#FFFFFF`
- Secondary: `#B3B3B3`
- Disabled: `#4D4D4D`

## 5. Typography

**Font**: System (SF Pro/Roboto) - maximum legibility in all conditions
**Scale**:
- Hero (Score): 48sp, Bold
- Title: 24sp, Bold
- Heading: 18sp, Semibold
- Body: 16sp, Regular
- Caption: 14sp, Regular
- Button: 16sp, Semibold

## 6. Visual Design

**Touchable Feedback**: 90% opacity on press
**Floating Buttons**: shadowOffset {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2
**Icons**: Feather icons (@expo/vector-icons)
**Match Action Buttons**: Minimum 72px height, 8px border-radius, bold uppercase labels
**Player Circles**: 48px diameter, white border, number centered

## 7. Assets to Generate

**Required**:
- `icon.png` - App icon: Whistle + pitch markings, pitch green on black
- `splash-icon.png` - Simplified whistle icon
- `empty-teams.png` - Empty clipboard with team badge outline. **Used**: Teams screen empty state
- `empty-matches.png` - Pitch diagram with zero scoreline. **Used**: Matches screen empty state
- `profile-avatar-1.png` - Generic manager silhouette. **Used**: Settings profile card

**Recommended**:
- `onboarding-pitch.png` - Illustrated pitch from above. **Used**: Optional first-launch screen
- `subscription-unlock.png` - Multiple team badges. **Used**: Subscription upgrade modal

**Asset Style**: Minimal line art, pitch green + white on dark, sharp/geometric (not playful).

---

**Critical UX Notes for Engineer**:
- Live Match screen must NEVER scroll vertically
- All buttons during match must be tappable with gloves (minimum 56px)
- Haptic feedback on every event log (medium impact)
- Pause button requires long-press (0.8s) to prevent accidental stops
- Timeline overlay dismisses on tap outside or swipe down