export type PlayerState = "starting" | "substitute" | "unavailable";

export interface Player {
  id: string;
  name: string;
  squadNumber?: number;
  state: PlayerState;
}

export interface Team {
  id: string;
  name: string;
  logoUri?: string;
  players: Player[];
  createdAt: string;
  lastMatchDate?: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  isArchived?: boolean;
}

export type MatchFormat = "5v5" | "7v7" | "9v9" | "11v11";
export type MatchLocation = "home" | "away";

export type GoalType = "open_play" | "corner" | "free_kick" | "penalty";
export type CardType = "yellow" | "red";
export type PenaltyOutcome = "scored" | "saved";

export interface MatchEvent {
  id: string;
  type: "goal_for" | "goal_against" | "card" | "penalty" | "substitution";
  timestamp: number; // match time in seconds
  playerId?: string;
  assistPlayerId?: string;
  goalType?: GoalType;
  cardType?: CardType;
  penaltyOutcome?: PenaltyOutcome;
  playerOffId?: string;
  playerOnId?: string;
  isForTeam?: boolean;
}

export interface Match {
  id: string;
  teamId: string;
  opposition: string;
  location: MatchLocation;
  format: MatchFormat;
  date: string;
  startingLineup: string[]; // player IDs
  substitutes: string[]; // player IDs
  unavailablePlayers?: string[]; // player IDs - not available for this match
  events: MatchEvent[];
  scoreFor: number;
  scoreAgainst: number;
  isCompleted: boolean;
  totalMatchTime: number; // in seconds
  addedTime: number; // in seconds (deprecated, use firstHalfAddedTime + secondHalfAddedTime)
  plannedDuration?: number; // planned game duration in minutes
  firstHalfAddedTime?: number; // added time in first half (seconds)
  secondHalfAddedTime?: number; // added time in second half (seconds)
  isHalfTime?: boolean; // whether currently at half time
  halfTimeTriggered?: boolean; // whether half time was triggered
  timerStartTimestamp?: number; // timestamp when timer was started (for accurate timing on iOS)
  accumulatedTime?: number; // accumulated time before current timer session
}

export interface SubscriptionState {
  isElite: boolean;
  maxTeams: number;
}

export interface AppState {
  teams: Team[];
  matches: Match[];
  subscription: SubscriptionState;
  currentMatchId?: string;
}
