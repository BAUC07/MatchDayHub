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
- Subscription logic (1 team free, unlimited for Elite)

## Architecture

### Frontend (Expo React Native)
- **Navigation**: React Navigation 7+ with tab bar (Teams, Matches, Stats, Settings)
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
- Tap on any player to edit their name or number inline
- NO player state selection here - that happens in Match Setup
- Players can be removed

### Match Setup
- Opposition name, location (home/away), format (5v5 to 11v11)
- **Lineup Selection**: Tap players to add to starting lineup
- Add new players directly from match setup (useful for late arrivals)
- Auto-assigns remaining players as substitutes

### Live Match (Critical - No Scroll)
- Three-zone fixed layout:
  1. Top: Score + clock + period indicator + timeline access
  2. Middle: Pitch diagram with players + bench
  3. Bottom: Action buttons (GOAL+, GOAL-, CARD, SUB, PENALTY, HT/END)
- Smart timer with half-time logic:
  - Uses timestamp-based timing for reliability on iOS (survives app backgrounding)
  - Counts up to half-time (plannedDuration/2), then shows added time (e.g., "45+2:30")
  - HT button triggers half-time break, resumes for second half
  - Button dynamically changes from "HT" to "END" in second half
  - Period indicator shows "1st Half", "HALF TIME", or "2nd Half"
  - Timer state persisted with timestamps to restore accurate time after app restart
- All events logged with timestamp
- Undo last event supported
- Pause/resume clock (long-press to pause)
- Timeline filter to hide substitution events

### Stats Tab
- Team selector when multiple teams exist
- Filter by All/Home/Away matches
- Results pie chart (wins, draws, losses)
- Goal Sources pie chart (open play, corner, free kick, penalty)
- Goals Conceded section (matches, total conceded, avg per game, clean sheets)
- Top Scorers table with goals and average per game
- Top Assists table with assists and average per game
- Cards Received table (yellow and red card breakdown)
- Minutes Played table with total minutes, matches played, and average per game
- PDF export button to generate and share season statistics

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
│   ├── StatsScreen.tsx
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
- **Match**: id, teamId, opposition, location, format, lineup, events[], scores, plannedDuration, firstHalfAddedTime, secondHalfAddedTime, isHalfTime, halfTimeTriggered
- **MatchEvent**: id, type, timestamp, playerId, assistPlayerId, goalType, cardType, penaltyOutcome, playerOffId, playerOnId

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
- Fixed timer reliability on iOS (uses timestamp-based timing that survives app backgrounding)
- Added date range filtering on Stats tab (defaults to current football season starting Aug 1)
- Rebranded subscription tier from "Premium" to "Elite" throughout app
- Added PDF export for team statistics (generates professional PDF with results, goals, scorers)
- Team selector on Stats tab when multiple teams exist
- Player name/number editing in Squad Editor (tap to edit inline)
- Add players directly from Match Setup screen (for late arrivals)
- Draggable player positions on the pitch during live matches (tap to log event, drag to reposition)
- Stats tab now locked behind Elite subscription with upgrade prompt UI
- Penalty terminology changed from "missed" to "saved"
- Penalty scorer selection when team scores a penalty
- Re-substitution enabled: players who were subbed off can be brought back on
- Compact match history layout showing more games per screen
- Club logo upload feature for teams (in creation and squad editor)
- Added Stats tab with pie charts and player statistics tables
- Redesigned timer with half-time logic and added time tracking
- Half-time button (HT) that becomes END button in second half
- Period indicator showing current match state
- Timeline filter to hide substitution events
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
