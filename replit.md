# MatchDay - Grassroots Football Match Logger

## Overview
MatchDay is a cross-platform mobile application (iOS and Android) designed for grassroots football managers. Its primary purpose is to enable real-time logging of match events, providing a pitch-side tool optimized for fast, one-handed use under pressure. The app facilitates team and squad management, match setup with lineup selection, live match event logging (goals, cards, penalties, substitutions), and offers a comprehensive match summary with timeline visualization. It includes local data persistence and a subscription model for advanced features.

## User Preferences
- Dark theme enforced for all screens
- No emojis in UI
- Large touch targets for outdoor use
- Haptic feedback enabled

## System Architecture

### Frontend (Expo React Native)
- **Navigation**: React Navigation 7+ with a tab bar for Teams, Matches, Stats, and Settings.
- **State Management**: Local state primarily managed with AsyncStorage for persistence.
- **UI/UX**: Custom components built on a "Stadium Bold" design system, utilizing a dark theme with pitch green (#00A86B) accents.
- **Key Features**:
    - **Teams Management**: Create, view, and manage teams, including an upgrade prompt for additional teams.
    - **Squad Editor**: Add, edit, and remove players with name and optional squad number.
    - **Match Setup**: Configure opposition, location, format (5v5 to 11v11), and duration. Features auto-populated lineups based on format, and the ability to mark players as unavailable with drag-and-drop functionality.
    - **Live Match**: Tabbed interface displaying match events timeline and team formation pitch diagram. Includes a 6-button grid for rapid event logging (goals, cards, penalties, substitutions, notes), a smart timer with half-time logic, and real-time timestamping of events. Supports red card management, re-substitution, and in-match player repositioning.
    - **Stats Tracking**: Provides detailed team and player statistics including results, goal sources, goals scored/conceded, top scorers/assists, cards received, and minutes played. Includes date range filtering and PDF export.
    - **Match Summary**: Displays final score, key stats, and a detailed timeline of events.
    - **Match Notes**: Functionality to add and edit match notes during and after games.

### Backend (Express.js)
- Serves static Expo files for web and manifest for mobile applications.
- Operates on port 5000 for API and static file serving.

### Data Flow
- All application data is stored locally using AsyncStorage, ensuring immediate persistence of teams, matches, and events.
- Match events are timestamped in real-time for accurate record-keeping.

### Design System
- **Colors**: Primary Pitch Green (#00A86B), Dark background (#0D0D0D), various shades for surfaces and elevations, with Yellow (#FFD700) for warnings and Red (#DC143C) for danger.
- **Typography**: Defined hierarchy from Hero (48px bold) down to Caption (12px).
- **Touch Targets**: Minimum 56px, with action buttons at 72px height, complemented by haptic feedback on interactions.

## External Dependencies
- **AsyncStorage**: For local data persistence.
- **React Navigation**: For managing application navigation.
- **Expo**: The development platform and framework for React Native.
- **Express.js**: Backend web application framework for serving files.
- **RevenueCat**: Integrated for future in-app purchases, currently used for code-based feature unlocks.