import { MatchFormat, Match, MatchEvent, Player } from "@/types";

export function formatMatchTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function formatMatchTimeWithAdded(
  seconds: number,
  addedTime: number
): string {
  const baseTime = formatMatchTime(seconds);
  if (addedTime > 0) {
    const addedMins = Math.floor(addedTime / 60);
    return `${baseTime} +${addedMins}`;
  }
  return baseTime;
}

export function getPlayersOnPitch(format: MatchFormat): number {
  switch (format) {
    case "5v5":
      return 5;
    case "7v7":
      return 7;
    case "9v9":
      return 9;
    case "11v11":
      return 11;
    default:
      return 11;
  }
}

export function getPlayerInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getPlayerDisplayName(player: Player): string {
  if (player.squadNumber !== undefined) {
    return player.squadNumber.toString();
  }
  return getPlayerInitials(player.name);
}

export function countGoalsFor(events: MatchEvent[]): number {
  return events.filter((e) => e.type === "goal_for").length;
}

export function countGoalsAgainst(events: MatchEvent[]): number {
  return events.filter((e) => e.type === "goal_against").length;
}

export function countYellowCards(events: MatchEvent[]): number {
  return events.filter((e) => e.type === "card" && e.cardType === "yellow")
    .length;
}

export function countRedCards(events: MatchEvent[]): number {
  return events.filter((e) => e.type === "card" && e.cardType === "red").length;
}

export function getMatchResult(
  match: Match
): "win" | "draw" | "loss" | "ongoing" {
  if (!match.isCompleted) return "ongoing";
  if (match.scoreFor > match.scoreAgainst) return "win";
  if (match.scoreFor < match.scoreAgainst) return "loss";
  return "draw";
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
