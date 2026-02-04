import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { Team, Match, SubscriptionState, AppState } from "@/types";

const STORAGE_KEYS = {
  TEAMS: "@matchday_teams",
  MATCHES: "@matchday_matches",
  SUBSCRIPTION: "@matchday_subscription",
  CURRENT_MATCH: "@matchday_current_match",
  OPPOSITION_NAMES: "@matchday_opposition_names",
  ONBOARDING_COMPLETED: "@matchday_onboarding_completed",
  COMPLETED_MATCH_COUNT: "@matchday_completed_match_count",
  REVIEW_PROMPTED: "@matchday_review_prompted",
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

export async function deleteTeamAndMatches(teamId: string): Promise<void> {
  const [teams, matches] = await Promise.all([getTeams(), getMatches()]);
  const filteredTeams = teams.filter((t) => t.id !== teamId);
  const filteredMatches = matches.filter((m) => m.teamId !== teamId);
  await Promise.all([saveTeams(filteredTeams), saveMatches(filteredMatches)]);
}

export async function archiveTeams(teamIds: string[]): Promise<void> {
  const teams = await getTeams();
  const updated = teams.map((t) =>
    teamIds.includes(t.id) ? { ...t, isArchived: true } : t
  );
  await saveTeams(updated);
}

export async function unarchiveTeam(teamId: string): Promise<void> {
  const teams = await getTeams();
  const updated = teams.map((t) =>
    t.id === teamId ? { ...t, isArchived: false } : t
  );
  await saveTeams(updated);
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

export async function getOppositionNames(): Promise<string[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.OPPOSITION_NAMES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting opposition names:", error);
    return [];
  }
}

export async function addOppositionName(name: string): Promise<void> {
  try {
    const names = await getOppositionNames();
    const trimmedName = name.trim();
    if (!names.includes(trimmedName)) {
      names.push(trimmedName);
      await AsyncStorage.setItem(STORAGE_KEYS.OPPOSITION_NAMES, JSON.stringify(names));
    }
  } catch (error) {
    console.error("Error adding opposition name:", error);
  }
}

const getTeamLogosDir = () => {
  const docDir = (FileSystem as any).documentDirectory || "";
  return `${docDir}team_logos/`;
};

async function ensureLogosDirectoryExists(): Promise<void> {
  const logosDir = getTeamLogosDir();
  if (!logosDir) return;
  const dirInfo = await FileSystem.getInfoAsync(logosDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(logosDir, { intermediates: true });
  }
}

export async function saveTeamLogo(tempUri: string, teamId: string): Promise<string> {
  try {
    await ensureLogosDirectoryExists();
    
    const logosDir = getTeamLogosDir();
    if (!logosDir) {
      throw new Error("Document directory not available");
    }
    
    const fileExtension = tempUri.split('.').pop()?.toLowerCase() || 'jpg';
    const permanentPath = `${logosDir}${teamId}.${fileExtension}`;
    
    const existingFile = await FileSystem.getInfoAsync(permanentPath);
    if (existingFile.exists) {
      await FileSystem.deleteAsync(permanentPath, { idempotent: true });
    }
    
    await FileSystem.copyAsync({
      from: tempUri,
      to: permanentPath,
    });
    
    return permanentPath;
  } catch (error) {
    console.error("Error saving team logo:", error);
    throw error;
  }
}

export async function deleteTeamLogo(teamId: string): Promise<void> {
  try {
    const logosDir = getTeamLogosDir();
    if (!logosDir) return;
    
    const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    for (const ext of extensions) {
      const path = `${logosDir}${teamId}.${ext}`;
      const fileInfo = await FileSystem.getInfoAsync(path);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
        break;
      }
    }
  } catch (error) {
    console.error("Error deleting team logo:", error);
  }
}

// Onboarding and Review Prompt Storage
export async function getOnboardingCompleted(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
    return value === "true";
  } catch (error) {
    console.error("Error getting onboarding status:", error);
    return false;
  }
}

export async function setOnboardingCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, "true");
  } catch (error) {
    console.error("Error setting onboarding status:", error);
  }
}

export async function getCompletedMatchCount(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_MATCH_COUNT);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    console.error("Error getting completed match count:", error);
    return 0;
  }
}

export async function incrementCompletedMatchCount(): Promise<number> {
  try {
    const current = await getCompletedMatchCount();
    const newCount = current + 1;
    await AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_MATCH_COUNT, newCount.toString());
    return newCount;
  } catch (error) {
    console.error("Error incrementing completed match count:", error);
    return 0;
  }
}

export async function getReviewPrompted(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.REVIEW_PROMPTED);
    return value === "true";
  } catch (error) {
    console.error("Error getting review prompted status:", error);
    return false;
  }
}

export async function setReviewPrompted(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.REVIEW_PROMPTED, "true");
  } catch (error) {
    console.error("Error setting review prompted status:", error);
  }
}

export async function clearAllData(): Promise<void> {
  try {
    const keys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error("Error clearing all data:", error);
    throw error;
  }
}
