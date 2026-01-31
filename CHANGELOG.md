# MatchDay Changelog

## Version 1.1.0 (January 2026)

### Bug Fixes
- **Fixed match completion race condition**: Matches now correctly save with completed status. Previously, the periodic auto-save could overwrite completed match data, causing timeline entries to display incorrectly.
- **Fixed team logo persistence**: Logos are now saved to permanent storage instead of temporary cache, ensuring they persist across app restarts.
- **Fixed iOS timer reliability**: Timer now uses timestamp-based timing that survives app backgrounding.

### Improvements
- **Performance optimization**: Memoized player data calculations to prevent unnecessary re-renders during live matches.
- **Match Setup enhancements**:
  - Opposition name input now shows autocomplete suggestions from previously used team names
  - Match duration auto-defaults based on format (5v5=40min, 7v7=50min, 9v9=60min, 11v11=90min)
  - Add Player button now opens a cleaner modal popup
- **Auto-populated lineup**: Starting lineup auto-fills based on match format
- **Unavailable players**: Mark players who can't make match day with long-press gesture

### Timeline
- Timeline now shows accurate timestamps for Kick Off, Half Time, and Full Time based on actual button press times
- Events display properly formatted match times (e.g., "45+3'" for added time)

---

## Version 1.0.x

### Initial Release Features
- Team and squad management
- Real-time match event logging (goals, cards, penalties, substitutions)
- Live match screen with pitch visualization
- Match summary with timeline
- Statistics tab with charts and tables
- PDF export for season statistics
- Subscription tiers (Free: 1 team, Elite: unlimited)
