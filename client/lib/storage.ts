import AsyncStorage from "@react-native-async-storage/async-storage";
import { Team, Match, SubscriptionState, AppState } from "@/types";

const STORAGE_KEYS = {
  TEAMS: "@matchday_teams",
  MATCHES: "@matchday_matches",
  SUBSCRIPTION: "@matchday_subscription",
  CURRENT_MATCH: "@matchday_current_match",
};

const DEFAULT_SUBSCRIPTION: SubscriptionState = {
  isElite: false,
  maxTeams: 1,
};

export async function getTeams(): Promise<Team[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TEAMS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting teams:", error);
    return [];
  }
}

export async function saveTeams(teams: Team[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
  } catch (error) {
    console.error("Error saving teams:", error);
    throw error;
  }
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const teams = await getTeams();
  return teams.find((t) => t.id === teamId) || null;
}

export async function saveTeam(team: Team): Promise<void> {
  const teams = await getTeams();
  const index = teams.findIndex((t) => t.id === team.id);
  if (index >= 0) {
    teams[index] = team;
  } else {
    teams.push(team);
  }
  await saveTeams(teams);
}

export async function deleteTeam(teamId: string): Promise<void> {
  const teams = await getTeams();
  const filtered = teams.filter((t) => t.id !== teamId);
  await saveTeams(filtered);
}

export async function getMatches(): Promise<Match[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MATCHES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting matches:", error);
    return [];
  }
}

export async function saveMatches(matches: Match[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches));
  } catch (error) {
    console.error("Error saving matches:", error);
    throw error;
  }
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const matches = await getMatches();
  return matches.find((m) => m.id === matchId) || null;
}

export async function saveMatch(match: Match): Promise<void> {
  const matches = await getMatches();
  const index = matches.findIndex((m) => m.id === match.id);
  if (index >= 0) {
    matches[index] = match;
  } else {
    matches.push(match);
  }
  await saveMatches(matches);
}

export async function deleteMatch(matchId: string): Promise<void> {
  const matches = await getMatches();
  const filtered = matches.filter((m) => m.id !== matchId);
  await saveMatches(filtered);
}

export async function getMatchesByTeam(teamId: string): Promise<Match[]> {
  const matches = await getMatches();
  return matches.filter((m) => m.teamId === teamId);
}

export async function getSubscription(): Promise<SubscriptionState> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SUBSCRIPTION);
    return data ? JSON.parse(data) : DEFAULT_SUBSCRIPTION;
  } catch (error) {
    console.error("Error getting subscription:", error);
    return DEFAULT_SUBSCRIPTION;
  }
}

export async function saveSubscription(
  subscription: SubscriptionState
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SUBSCRIPTION,
      JSON.stringify(subscription)
    );
  } catch (error) {
    console.error("Error saving subscription:", error);
    throw error;
  }
}

export async function getCurrentMatchId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_MATCH);
  } catch (error) {
    console.error("Error getting current match:", error);
    return null;
  }
}

export async function setCurrentMatchId(matchId: string | null): Promise<void> {
  try {
    if (matchId) {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_MATCH, matchId);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_MATCH);
    }
  } catch (error) {
    console.error("Error setting current match:", error);
    throw error;
  }
}

export async function getAppState(): Promise<AppState> {
  const [teams, matches, subscription, currentMatchId] = await Promise.all([
    getTeams(),
    getMatches(),
    getSubscription(),
    getCurrentMatchId(),
  ]);

  return {
    teams,
    matches,
    subscription,
    currentMatchId: currentMatchId || undefined,
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
