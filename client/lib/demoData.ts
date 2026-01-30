import { Team, Match, MatchEvent, Player } from "@/types";
import { generateId } from "./storage";

const PLAYER_NAMES = [
  "Jack Wilson", "Oliver Smith", "Harry Brown", "George Taylor",
  "Charlie Davies", "Thomas Martin", "James Anderson", "William Thompson",
  "Daniel White", "Ethan Jackson", "Lucas Harris", "Mason Clark",
  "Henry Lewis", "Alexander Walker", "Sebastian Hall", "Noah Young"
];

const OPPOSITION_NAMES = [
  "Riverside Rovers", "Valley United", "City Rangers", "Park Athletic",
  "Meadow Town", "Forest Green", "Hill Top FC", "Lakeside Boys",
  "Central Stars", "Northern Lions"
];

function createPlayer(name: string, squadNumber: number): Player {
  return {
    id: generateId(),
    name,
    squadNumber,
    state: "starting",
  };
}

function createTeam(name: string, playerCount: number = 14): Team {
  const players: Player[] = [];
  for (let i = 0; i < playerCount; i++) {
    players.push(createPlayer(PLAYER_NAMES[i] || `Player ${i + 1}`, i + 1));
  }
  
  return {
    id: generateId(),
    name,
    players,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  };
}

function createMatchEvents(
  match: Match,
  team: Team,
  scoreFor: number,
  scoreAgainst: number
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const startingPlayers = match.startingLineup;
  const matchDuration = match.plannedDuration || 60;
  
  const goalTypes: Array<"open_play" | "corner" | "free_kick" | "penalty"> = [
    "open_play", "open_play", "open_play", "corner", "free_kick", "penalty"
  ];
  
  for (let i = 0; i < scoreFor; i++) {
    const scorerId = startingPlayers[Math.floor(Math.random() * startingPlayers.length)];
    const hasAssist = Math.random() > 0.3;
    const assisterId = hasAssist 
      ? startingPlayers.filter(id => id !== scorerId)[Math.floor(Math.random() * (startingPlayers.length - 1))]
      : undefined;
    
    events.push({
      id: generateId(),
      type: "goal_for",
      timestamp: Math.floor(Math.random() * matchDuration * 60),
      playerId: scorerId,
      assistPlayerId: assisterId,
      goalType: goalTypes[Math.floor(Math.random() * goalTypes.length)],
    });
  }
  
  for (let i = 0; i < scoreAgainst; i++) {
    events.push({
      id: generateId(),
      type: "goal_against",
      timestamp: Math.floor(Math.random() * matchDuration * 60),
    });
  }
  
  if (Math.random() > 0.7) {
    const cardReceiver = startingPlayers[Math.floor(Math.random() * startingPlayers.length)];
    events.push({
      id: generateId(),
      type: "card",
      timestamp: Math.floor(Math.random() * matchDuration * 60),
      playerId: cardReceiver,
      cardType: Math.random() > 0.85 ? "red" : "yellow",
    });
  }
  
  if (match.substitutes.length > 0 && Math.random() > 0.5) {
    const playerOff = startingPlayers[Math.floor(Math.random() * startingPlayers.length)];
    const playerOn = match.substitutes[Math.floor(Math.random() * match.substitutes.length)];
    events.push({
      id: generateId(),
      type: "substitution",
      timestamp: Math.floor((matchDuration / 2 + Math.random() * matchDuration / 2) * 60),
      playerOffId: playerOff,
      playerOnId: playerOn,
    });
  }
  
  return events.sort((a, b) => a.timestamp - b.timestamp);
}

function createMatch(
  team: Team,
  daysAgo: number,
  scoreFor: number,
  scoreAgainst: number,
  oppositionIndex: number
): Match {
  const format = "9v9" as const;
  const startingCount = 9;
  const startingLineup = team.players.slice(0, startingCount).map(p => p.id);
  const substitutes = team.players.slice(startingCount).map(p => p.id);
  
  const match: Match = {
    id: generateId(),
    teamId: team.id,
    opposition: OPPOSITION_NAMES[oppositionIndex % OPPOSITION_NAMES.length],
    location: Math.random() > 0.5 ? "home" : "away",
    format,
    date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    startingLineup,
    substitutes,
    events: [],
    scoreFor,
    scoreAgainst,
    isCompleted: true,
    totalMatchTime: 60 * 60,
    addedTime: 0,
    plannedDuration: 60,
  };
  
  match.events = createMatchEvents(match, team, scoreFor, scoreAgainst);
  
  return match;
}

export function generateDemoData(): { team: Team; matches: Match[] } {
  const team = createTeam("Westside Warriors U12", 14);
  
  const matchResults = [
    { daysAgo: 7, scoreFor: 3, scoreAgainst: 1 },
    { daysAgo: 14, scoreFor: 2, scoreAgainst: 2 },
    { daysAgo: 21, scoreFor: 4, scoreAgainst: 0 },
    { daysAgo: 28, scoreFor: 1, scoreAgainst: 2 },
    { daysAgo: 35, scoreFor: 3, scoreAgainst: 3 },
    { daysAgo: 42, scoreFor: 5, scoreAgainst: 1 },
    { daysAgo: 49, scoreFor: 2, scoreAgainst: 1 },
    { daysAgo: 56, scoreFor: 0, scoreAgainst: 1 },
    { daysAgo: 63, scoreFor: 4, scoreAgainst: 2 },
    { daysAgo: 70, scoreFor: 3, scoreAgainst: 0 },
  ];
  
  const matches: Match[] = matchResults.map((result, index) => 
    createMatch(team, result.daysAgo, result.scoreFor, result.scoreAgainst, index)
  );
  
  let wins = 0, draws = 0, losses = 0;
  matches.forEach(m => {
    if (m.scoreFor > m.scoreAgainst) wins++;
    else if (m.scoreFor === m.scoreAgainst) draws++;
    else losses++;
  });
  
  team.matchesPlayed = matches.length;
  team.wins = wins;
  team.draws = draws;
  team.losses = losses;
  team.lastMatchDate = matches[0].date;
  
  return { team, matches };
}
