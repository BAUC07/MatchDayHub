# MatchDay - Grassroots Football Match Logger

## Overview
A cross-platform mobile app (iOS and Android) for grassroots football managers to log match activity in real time. This is a pitch-side tool designed for fast, one-handed use under pressure.

## Current State
MVP complete with core functionality:
- Team and squad management
- Match setup with lineup selection
- Live match event logging (goals, cards, penalties, substitutions)
- Match summary with timeline visualization
- Local data persistence using AsyncStorage
- Subscription logic (1 team free, unlimited for premium)

## Architecture

### Frontend (Expo React Native)
- **Navigation**: React Navigation 7+ with tab bar (Teams, Matches, Settings)
- **State Management**: Local state with AsyncStorage persistence
- **UI Framework**: Custom components following Stadium Bold design system
- **Styling**: Dark theme with pitch green (#00A86B) accents

### Backend (Express.js)
- Serves static Expo files for web and manifest for mobile
- Port 5000 for API/static files

### Data Flow
1. All data stored locally in AsyncStorage
2. Teams, matches, and events are persisted immediately
3. Match events are timestamped in real-time

## Key Screens

### Teams Tab
- Shows list of teams with stats
- Prominent "Create Team" card at top with dashed border
- Upgrade prompt if user hits team limit (free: 1 team max)

### Team Detail
- Team statistics (played, won, drawn, lost)
- Squad list (just names and numbers)
- "Start Match" floating action button

### Squad Editor
- Simple form to add players (name + optional squad number)
- NO player state selection here - that happens in Match Setup
- Players can be removed

### Match Setup
- Opposition name, location (home/away), format (5v5 to 11v11)
- **Lineup Selection**: Tap players to add to starting lineup
- Auto-assigns remaining players as substitutes

### Live Match (Critical - No Scroll)
- Three-zone fixed layout:
  1. Top: Score + clock + timeline access
  2. Middle: Pitch diagram with players + bench
  3. Bottom: Action buttons (GOAL+, GOAL-, CARD, SUB, PENALTY, END)
- All events logged with timestamp
- Undo last event supported
- Pause/resume clock (long-press to pause)

### Match Summary
- Final score with result badge
- Stats grid (goals for/against, cards)
- Timeline visualization with event markers

## File Structure
```
client/
├── App.tsx                    # Root with ErrorBoundary
├── components/               
│   ├── Button.tsx             # Animated button
│   ├── Card.tsx               # Elevated card component
│   ├── HeaderTitle.tsx        # App branding header
│   ├── ThemedText.tsx         # Themed typography
│   └── ThemedView.tsx         # Themed container
├── constants/
│   └── theme.ts               # Colors, spacing, typography
├── hooks/
│   ├── useColorScheme.ts
│   ├── useScreenOptions.ts    # Navigation options
│   └── useTheme.ts
├── lib/
│   ├── query-client.ts        # API utilities
│   ├── storage.ts             # AsyncStorage CRUD
│   └── utils.ts               # Formatting helpers
├── navigation/
│   ├── MainTabNavigator.tsx   # Bottom tabs
│   ├── RootStackNavigator.tsx # Stack screens
│   └── *StackNavigator.tsx    # Tab stacks
├── screens/
│   ├── TeamsScreen.tsx
│   ├── TeamDetailScreen.tsx
│   ├── SquadEditorScreen.tsx
│   ├── CreateTeamScreen.tsx
│   ├── MatchesScreen.tsx
│   ├── MatchSetupScreen.tsx
│   ├── LiveMatchScreen.tsx
│   ├── MatchSummaryScreen.tsx
│   └── SettingsScreen.tsx
└── types/
    └── index.ts               # TypeScript interfaces

server/
├── index.ts                   # Express server
└── templates/
    └── landing-page.html      # Web landing page
```

## Data Models
- **Team**: id, name, players[], stats (matches, wins, draws, losses)
- **Player**: id, name, squadNumber?, state (managed at match time)
- **Match**: id, teamId, opposition, location, format, lineup, events[], scores
- **MatchEvent**: id, type, timestamp, playerId, details

## Design System

### Colors
- Primary: Pitch Green #00A86B
- Background: Dark #0D0D0D
- Surface: #1F1F1F
- Elevated: #2A2A2A
- Warning: Yellow #FFD700
- Danger: Red #DC143C

### Typography
- Hero: 48px bold (scores)
- H1-H4: 32/28/24/20px
- Body: 16px
- Small: 14px
- Caption: 12px

### Touch Targets
- Minimum 56px for match actions
- Action buttons: 72px height
- Haptic feedback on all interactions

## Recent Changes
- Simplified squad editor (removed player state selection)
- Added lineup selection to match setup screen
- Prominent "Create Team" card on Teams screen

## Development Commands
- Frontend: `npm run expo:dev` (port 8081)
- Backend: `npm run server:dev` (port 5000)

## User Preferences
- Dark theme enforced for all screens
- No emojis in UI
- Large touch targets for outdoor use
- Haptic feedback enabled
