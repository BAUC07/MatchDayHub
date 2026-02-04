import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Svg, { Path, Circle, G, Text as SvgText } from "react-native-svg";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Match, MatchEvent, Team, Player } from "@/types";
import { getMatches, getTeams } from "@/lib/storage";
import { useRevenueCat } from "@/lib/revenuecat";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type FilterType = "all" | "home" | "away";

const getDefaultSeasonStartDate = (): Date => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  if (currentMonth >= 7) {
    return new Date(currentYear, 7, 1);
  } else {
    return new Date(currentYear - 1, 7, 1);
  }
};

const formatDateDisplay = (date: Date): string => {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface PlayerStat {
  playerId: string;
  playerName: string;
  squadNumber?: number;
  count: number;
  matches: number;
}

interface MinutesStat extends PlayerStat {
  avgPerGame: number;
}

interface GoalsConcededStat {
  matchesPlayed: number;
  totalConceded: number;
  avgPerGame: number;
  cleanSheets: number;
}

interface GoalsScoredStat {
  matchesPlayed: number;
  totalScored: number;
  avgPerGame: number;
  blankGames: number;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { isElite, unlockWithCode } = useRevenueCat();

  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [startDate, setStartDate] = useState<Date>(getDefaultSeasonStartDate);
  const [endDate, setEndDate] = useState<Date>(new Date);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [codeError, setCodeError] = useState('');
  
  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [matchesData, teamsData] = await Promise.all([
        getMatches(),
        getTeams(),
      ]);
      setMatches(matchesData.filter(m => m.isCompleted));
      setTeams(teamsData);
      setSelectedTeamId((prev) => {
        if (prev === null && teamsData.length > 0) {
          return teamsData[0].id;
        }
        return prev;
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCodeSubmit = useCallback(async () => {
    if (!codeValue.trim()) {
      setCodeError('Please enter a code');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await unlockWithCode(codeValue.trim());
    if (success) {
      setShowCodeInput(false);
      setCodeValue('');
      setCodeError('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setCodeError('Invalid code');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [codeValue, unlockWithCode]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;
  
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (selectedTeamId && m.teamId !== selectedTeamId) return false;
      if (filter !== "all" && m.location !== filter) return false;
      
      const matchDate = new Date(m.date);
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      if (matchDate < startOfDay || matchDate > endOfDay) return false;
      
      return true;
    });
  }, [matches, selectedTeamId, filter, startDate, endDate]);
  
  const handleStartDateChange = useCallback((event: any, date?: Date) => {
    setShowStartPicker(Platform.OS === "ios");
    if (date) {
      Haptics.selectionAsync();
      setStartDate(date);
    }
  }, []);
  
  const handleEndDateChange = useCallback((event: any, date?: Date) => {
    setShowEndPicker(Platform.OS === "ios");
    if (date) {
      Haptics.selectionAsync();
      setEndDate(date);
    }
  }, []);

  const handleWebStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const newDate = new Date(dateValue + "T00:00:00");
      Haptics.selectionAsync();
      setStartDate(newDate);
    }
  }, []);

  const handleWebEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const newDate = new Date(dateValue + "T00:00:00");
      Haptics.selectionAsync();
      setEndDate(newDate);
    }
  }, []);

  const renderDateFilters = useCallback(() => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.dateFilterContainer}>
          <ThemedText type="small" style={styles.dateFilterLabel}>
            Date Range
          </ThemedText>
          <View style={styles.dateButtonsRow}>
            <View style={styles.dateButton}>
              <Feather name="calendar" size={14} color={AppColors.pitchGreen} />
              <input
                type="date"
                value={formatDateForInput(startDate)}
                max={formatDateForInput(endDate)}
                onChange={handleWebStartDateChange as any}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  outline: "none",
                }}
              />
            </View>
            <ThemedText type="small" style={styles.dateSeparator}>to</ThemedText>
            <View style={styles.dateButton}>
              <Feather name="calendar" size={14} color={AppColors.pitchGreen} />
              <input
                type="date"
                value={formatDateForInput(endDate)}
                min={formatDateForInput(startDate)}
                max={formatDateForInput(new Date())}
                onChange={handleWebEndDateChange as any}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  outline: "none",
                }}
              />
            </View>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.dateFilterContainer}>
        <ThemedText type="small" style={styles.dateFilterLabel}>
          Date Range
        </ThemedText>
        <View style={styles.dateButtonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.dateButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setShowStartPicker(true);
            }}
          >
            <Feather name="calendar" size={14} color={AppColors.pitchGreen} />
            <ThemedText type="small" style={styles.dateButtonText}>
              {formatDateDisplay(startDate)}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" style={styles.dateSeparator}>to</ThemedText>
          <Pressable
            style={({ pressed }) => [
              styles.dateButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setShowEndPicker(true);
            }}
          >
            <Feather name="calendar" size={14} color={AppColors.pitchGreen} />
            <ThemedText type="small" style={styles.dateButtonText}>
              {formatDateDisplay(endDate)}
            </ThemedText>
          </Pressable>
        </View>
        
        {showStartPicker ? (
          Platform.OS === "ios" ? (
            <Modal transparent animationType="fade" visible={showStartPicker}>
              <Pressable
                style={styles.datePickerOverlay}
                onPress={() => setShowStartPicker(false)}
              >
                <View style={styles.datePickerModal}>
                  <View style={styles.datePickerHeader}>
                    <ThemedText type="body" style={styles.datePickerTitle}>
                      Start Date
                    </ThemedText>
                    <Pressable onPress={() => setShowStartPicker(false)}>
                      <ThemedText type="body" style={styles.datePickerDone}>
                        Done
                      </ThemedText>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display="spinner"
                    onChange={handleStartDateChange}
                    maximumDate={endDate}
                    themeVariant="dark"
                  />
                </View>
              </Pressable>
            </Modal>
          ) : (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={handleStartDateChange}
              maximumDate={endDate}
            />
          )
        ) : null}
        
        {showEndPicker ? (
          Platform.OS === "ios" ? (
            <Modal transparent animationType="fade" visible={showEndPicker}>
              <Pressable
                style={styles.datePickerOverlay}
                onPress={() => setShowEndPicker(false)}
              >
                <View style={styles.datePickerModal}>
                  <View style={styles.datePickerHeader}>
                    <ThemedText type="body" style={styles.datePickerTitle}>
                      End Date
                    </ThemedText>
                    <Pressable onPress={() => setShowEndPicker(false)}>
                      <ThemedText type="body" style={styles.datePickerDone}>
                        Done
                      </ThemedText>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display="spinner"
                    onChange={handleEndDateChange}
                    minimumDate={startDate}
                    maximumDate={new Date()}
                    themeVariant="dark"
                  />
                </View>
              </Pressable>
            </Modal>
          ) : (
            <DateTimePicker
              value={endDate}
              mode="date"
              display="default"
              onChange={handleEndDateChange}
              minimumDate={startDate}
              maximumDate={new Date()}
            />
          )
        ) : null}
      </View>
    );
  }, [startDate, endDate, showStartPicker, showEndPicker, handleStartDateChange, handleEndDateChange, handleWebStartDateChange, handleWebEndDateChange]);

  const getPlayerName = (playerId: string): string => {
    for (const team of teams) {
      const player = team.players.find((p) => p.id === playerId);
      if (player) return player.name;
    }
    return "Unknown";
  };

  const getPlayerSquadNumber = (playerId: string): number | undefined => {
    for (const team of teams) {
      const player = team.players.find((p) => p.id === playerId);
      if (player) return player.squadNumber;
    }
    return undefined;
  };

  const resultsData = {
    wins: filteredMatches.filter((m) => m.scoreFor > m.scoreAgainst).length,
    draws: filteredMatches.filter((m) => m.scoreFor === m.scoreAgainst).length,
    losses: filteredMatches.filter((m) => m.scoreFor < m.scoreAgainst).length,
  };

  const goalsData = (() => {
    let openPlay = 0;
    let corner = 0;
    let freeKick = 0;
    let penalty = 0;
    
    filteredMatches.forEach((match) => {
      match.events.forEach((event) => {
        if (event.type === "goal_for") {
          switch (event.goalType) {
            case "open_play": openPlay++; break;
            case "corner": corner++; break;
            case "free_kick": freeKick++; break;
            case "penalty": penalty++; break;
            default: openPlay++; break;
          }
        }
      });
    });
    
    return { openPlay, corner, freeKick, penalty };
  })();

  const topScorers: PlayerStat[] = (() => {
    const scorerMap = new Map<string, { goals: number; matchIds: Set<string> }>();
    
    filteredMatches.forEach((match) => {
      match.events.forEach((event) => {
        if (event.type === "goal_for" && event.playerId) {
          const current = scorerMap.get(event.playerId) || { goals: 0, matchIds: new Set<string>() };
          current.goals++;
          current.matchIds.add(match.id);
          scorerMap.set(event.playerId, current);
        }
      });
    });

    return Array.from(scorerMap.entries())
      .map(([playerId, data]) => ({
        playerId,
        playerName: getPlayerName(playerId),
        squadNumber: getPlayerSquadNumber(playerId),
        count: data.goals,
        matches: data.matchIds.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const topAssists: PlayerStat[] = (() => {
    const assistMap = new Map<string, { assists: number; matchIds: Set<string> }>();
    
    filteredMatches.forEach((match) => {
      match.events.forEach((event) => {
        if (event.type === "goal_for" && event.assistPlayerId) {
          const current = assistMap.get(event.assistPlayerId) || { assists: 0, matchIds: new Set<string>() };
          current.assists++;
          current.matchIds.add(match.id);
          assistMap.set(event.assistPlayerId, current);
        }
      });
    });

    return Array.from(assistMap.entries())
      .map(([playerId, data]) => ({
        playerId,
        playerName: getPlayerName(playerId),
        squadNumber: getPlayerSquadNumber(playerId),
        count: data.assists,
        matches: data.matchIds.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const cardsReceived = (() => {
    const cardMap = new Map<string, { yellow: number; red: number; matchIds: Set<string> }>();
    
    filteredMatches.forEach((match) => {
      match.events.forEach((event) => {
        if (event.type === "card" && event.playerId && event.isForTeam) {
          const current = cardMap.get(event.playerId) || { yellow: 0, red: 0, matchIds: new Set<string>() };
          if (event.cardType === "yellow") current.yellow++;
          if (event.cardType === "red" || event.cardType === "second_yellow") current.red++;
          current.matchIds.add(match.id);
          cardMap.set(event.playerId, current);
        }
      });
    });

    return Array.from(cardMap.entries())
      .map(([playerId, cards]) => ({
        playerId,
        playerName: getPlayerName(playerId),
        squadNumber: getPlayerSquadNumber(playerId),
        count: cards.yellow + cards.red * 2,
        matches: cards.matchIds.size,
        yellowCards: cards.yellow,
        redCards: cards.red,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const goalsConceded: GoalsConcededStat = (() => {
    const matchesPlayed = filteredMatches.length;
    const totalConceded = filteredMatches.reduce((sum, m) => sum + m.scoreAgainst, 0);
    const cleanSheets = filteredMatches.filter((m) => m.scoreAgainst === 0).length;
    const avgPerGame = matchesPlayed > 0 ? totalConceded / matchesPlayed : 0;
    
    return { matchesPlayed, totalConceded, avgPerGame, cleanSheets };
  })();

  const goalsScored: GoalsScoredStat = (() => {
    const matchesPlayed = filteredMatches.length;
    const totalScored = filteredMatches.reduce((sum, m) => sum + m.scoreFor, 0);
    const blankGames = filteredMatches.filter((m) => m.scoreFor === 0).length;
    const avgPerGame = matchesPlayed > 0 ? totalScored / matchesPlayed : 0;
    
    return { matchesPlayed, totalScored, avgPerGame, blankGames };
  })();

  const playerMinutes: MinutesStat[] = (() => {
    const minutesMap = new Map<string, { minutes: number; matches: number }>();
    
    filteredMatches.forEach((match) => {
      const matchDuration = match.totalMatchTime / 60;
      
      // Track periods on pitch for each player: array of {start, end} intervals
      const playerIntervals = new Map<string, { start: number; end: number }[]>();
      // Track if player is currently on pitch and when they started
      const currentlyOnPitch = new Map<string, number>();
      
      // Initialize starting lineup players as on pitch from minute 0
      match.startingLineup.forEach((playerId) => {
        currentlyOnPitch.set(playerId, 0);
        playerIntervals.set(playerId, []);
      });
      
      // Process substitutions and red cards chronologically
      const relevantEvents = match.events
        .filter((e) => e.type === "substitution" || e.type === "card")
        .sort((a, b) => a.timestamp - b.timestamp);
      
      relevantEvents.forEach((event) => {
        const eventTime = event.timestamp / 60;
        
        if (event.type === "substitution") {
          // Player going off - record their interval and mark as off pitch
          if (event.playerOffId && currentlyOnPitch.has(event.playerOffId)) {
            const startTime = currentlyOnPitch.get(event.playerOffId)!;
            const intervals = playerIntervals.get(event.playerOffId) || [];
            intervals.push({ start: startTime, end: eventTime });
            playerIntervals.set(event.playerOffId, intervals);
            currentlyOnPitch.delete(event.playerOffId);
          }
          
          // Player coming on - mark as on pitch from this time
          if (event.playerOnId) {
            currentlyOnPitch.set(event.playerOnId, eventTime);
            if (!playerIntervals.has(event.playerOnId)) {
              playerIntervals.set(event.playerOnId, []);
            }
          }
        } else if (event.type === "card" && (event.cardType === "red" || event.cardType === "second_yellow")) {
          // Red card or second yellow - player is sent off, record their interval
          if (event.playerId && currentlyOnPitch.has(event.playerId)) {
            const startTime = currentlyOnPitch.get(event.playerId)!;
            const intervals = playerIntervals.get(event.playerId) || [];
            intervals.push({ start: startTime, end: eventTime });
            playerIntervals.set(event.playerId, intervals);
            currentlyOnPitch.delete(event.playerId);
          }
        }
      });
      
      // Close out intervals for players still on pitch at end of match
      currentlyOnPitch.forEach((startTime, playerId) => {
        const intervals = playerIntervals.get(playerId) || [];
        intervals.push({ start: startTime, end: matchDuration });
        playerIntervals.set(playerId, intervals);
      });
      
      // Calculate total minutes for each player
      playerIntervals.forEach((intervals, playerId) => {
        const totalMinutes = intervals.reduce((sum, { start, end }) => sum + Math.max(0, end - start), 0);
        if (totalMinutes > 0 || intervals.length > 0) {
          const current = minutesMap.get(playerId) || { minutes: 0, matches: 0 };
          current.minutes += totalMinutes;
          current.matches += 1;
          minutesMap.set(playerId, current);
        }
      });
    });

    return Array.from(minutesMap.entries())
      .map(([playerId, data]) => ({
        playerId,
        playerName: getPlayerName(playerId),
        squadNumber: getPlayerSquadNumber(playerId),
        count: Math.round(data.minutes),
        matches: data.matches,
        avgPerGame: data.matches > 0 ? Math.round(data.minutes / data.matches) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const handleExportPDF = useCallback(async () => {
    if (!selectedTeam) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const totalGoals = resultsData.wins + resultsData.draws + resultsData.losses > 0
      ? filteredMatches.reduce((sum, m) => sum + m.scoreFor, 0)
      : 0;
    const totalConceded = filteredMatches.reduce((sum, m) => sum + m.scoreAgainst, 0);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #fff; color: #333; }
            h1 { color: #00A86B; border-bottom: 3px solid #00A86B; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            .stats-grid { display: flex; flex-wrap: wrap; gap: 20px; margin: 20px 0; }
            .stat-box { background: #f5f5f5; padding: 20px; border-radius: 8px; min-width: 120px; text-align: center; }
            .stat-value { font-size: 32px; font-weight: bold; color: #00A86B; }
            .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f5f5f5; font-weight: 600; }
            .number { text-align: center; width: 50px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${selectedTeam.name} - Season Statistics</h1>
          <p style="color: #666;">Generated on ${new Date().toLocaleDateString()}</p>
          
          <h2>Results Overview</h2>
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">${filteredMatches.length}</div>
              <div class="stat-label">Matches Played</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #4CAF50">${resultsData.wins}</div>
              <div class="stat-label">Wins</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #FF9800">${resultsData.draws}</div>
              <div class="stat-label">Draws</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #f44336">${resultsData.losses}</div>
              <div class="stat-label">Losses</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalGoals}</div>
              <div class="stat-label">Goals Scored</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalConceded}</div>
              <div class="stat-label">Goals Conceded</div>
            </div>
          </div>

          <h2>Goal Sources</h2>
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">${goalsData.openPlay}</div>
              <div class="stat-label">Open Play</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${goalsData.corner}</div>
              <div class="stat-label">Corners</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${goalsData.freeKick}</div>
              <div class="stat-label">Free Kicks</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${goalsData.penalty}</div>
              <div class="stat-label">Penalties</div>
            </div>
          </div>

          <h2>Defensive Record</h2>
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">${goalsConceded.matchesPlayed}</div>
              <div class="stat-label">Matches</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #f44336">${goalsConceded.totalConceded}</div>
              <div class="stat-label">Conceded</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #666">${goalsConceded.avgPerGame.toFixed(1)}</div>
              <div class="stat-label">Per Game</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #00A86B">${goalsConceded.cleanSheets}</div>
              <div class="stat-label">Clean Sheets</div>
            </div>
          </div>

          ${topScorers.length > 0 ? `
          <h2>Top Scorers</h2>
          <table>
            <tr><th class="number">#</th><th>Player</th><th class="number">Goals</th><th class="number">Avg</th></tr>
            ${topScorers.map((p, i) => `
              <tr>
                <td class="number">${i + 1}</td>
                <td>${p.squadNumber ? p.squadNumber + '. ' : ''}${p.playerName}</td>
                <td class="number">${p.count}</td>
                <td class="number" style="color: #666">${p.matches > 0 ? (p.count / p.matches).toFixed(1) : '0.0'}</td>
              </tr>
            `).join('')}
          </table>
          ` : ''}

          ${topAssists.length > 0 ? `
          <h2>Top Assists</h2>
          <table>
            <tr><th class="number">#</th><th>Player</th><th class="number">Assists</th><th class="number">Avg</th></tr>
            ${topAssists.map((p, i) => `
              <tr>
                <td class="number">${i + 1}</td>
                <td>${p.squadNumber ? p.squadNumber + '. ' : ''}${p.playerName}</td>
                <td class="number">${p.count}</td>
                <td class="number" style="color: #666">${p.matches > 0 ? (p.count / p.matches).toFixed(1) : '0.0'}</td>
              </tr>
            `).join('')}
          </table>
          ` : ''}

          ${cardsReceived.length > 0 ? `
          <h2>Disciplinary Record</h2>
          <table>
            <tr><th class="number">#</th><th>Player</th><th class="number" style="color: #FFD700">Yellow</th><th class="number" style="color: #DC143C">Red</th></tr>
            ${cardsReceived.map((p: any, i: number) => `
              <tr>
                <td class="number">${i + 1}</td>
                <td>${p.squadNumber ? p.squadNumber + '. ' : ''}${p.playerName}</td>
                <td class="number">${p.yellowCards}</td>
                <td class="number">${p.redCards}</td>
              </tr>
            `).join('')}
          </table>
          ` : ''}

          <div class="footer">
            MatchDay - Grassroots Football Match Logger
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      
      if (Platform.OS === "web") {
        Alert.alert("PDF Generated", "PDF export is not fully supported on web. Please use the mobile app for PDF export.");
        return;
      }
      
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${selectedTeam.name} Statistics`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Success", "PDF has been generated successfully.");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    }
  }, [selectedTeam, filteredMatches, resultsData, goalsData, goalsConceded, goalsScored, topScorers, topAssists, cardsReceived]);

  const renderPieChart = (
    data: { value: number; color: string; label: string }[],
    size: number = 120
  ) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) {
      return (
        <View style={[styles.pieChart, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 5}
              fill={AppColors.elevated}
            />
          </Svg>
          <View style={styles.pieChartCenter}>
            <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
              No data
            </ThemedText>
          </View>
        </View>
      );
    }

    const radius = size / 2 - 5;
    const centerX = size / 2;
    const centerY = size / 2;
    let currentAngle = -90;

    const paths = data.map((segment, index) => {
      if (segment.value === 0) return null;
      
      const percentage = segment.value / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

      return (
        <Path key={index} d={pathData} fill={segment.color} />
      );
    });

    return (
      <View style={styles.pieChartContainer}>
        <Svg width={size} height={size}>
          <G>{paths}</G>
        </Svg>
        <View style={styles.pieLegend}>
          {data.map((segment, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
              <ThemedText type="small" style={styles.legendText}>
                {segment.label}: {segment.value}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderFilterButtons = () => (
    <View style={styles.filterRow}>
      {(["all", "home", "away"] as FilterType[]).map((f) => (
        <Pressable
          key={f}
          style={[
            styles.filterButton,
            filter === f && styles.filterButtonActive,
          ]}
          onPress={() => setFilter(f)}
        >
          <ThemedText
            type="small"
            style={[
              styles.filterButtonText,
              filter === f && styles.filterButtonTextActive,
            ]}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderTable = (
    title: string,
    data: PlayerStat[],
    valueLabel: string = "Count"
  ) => (
    <Card elevation={1} style={styles.tableCard}>
      <ThemedText type="h4" style={styles.tableTitle}>
        {title}
      </ThemedText>
      {data.length === 0 ? (
        <ThemedText type="small" style={styles.noDataText}>
          No data available
        </ThemedText>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.rankCell]}>
              #
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.playerCell]}>
              Player
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.valueCell]}>
              {valueLabel}
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.avgCell]}>
              Avg
            </ThemedText>
          </View>
          {data.map((item, index) => {
            const avg = item.matches > 0 ? (item.count / item.matches).toFixed(1) : "0.0";
            return (
              <View key={item.playerId} style={styles.tableRow}>
                <ThemedText type="body" style={[styles.tableCell, styles.rankCell]}>
                  {index + 1}
                </ThemedText>
                <ThemedText type="body" style={[styles.tableCell, styles.playerCell]} numberOfLines={1}>
                  {item.squadNumber ? `${item.squadNumber}. ` : ""}{item.playerName}
                </ThemedText>
                <ThemedText type="body" style={[styles.tableCell, styles.valueCell]}>
                  {item.count}
                </ThemedText>
                <ThemedText type="body" style={[styles.tableCell, styles.avgCell, { color: AppColors.textSecondary }]}>
                  {avg}
                </ThemedText>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );

  const renderGoalsConceded = () => (
    <Card elevation={1} style={styles.tableCard}>
      <ThemedText type="h4" style={styles.tableTitle}>
        Goals Conceded
      </ThemedText>
      <View style={styles.concededGrid}>
        <View style={styles.concededItem}>
          <ThemedText type="h3" style={styles.concededValue}>
            {goalsConceded.matchesPlayed}
          </ThemedText>
          <ThemedText type="caption" style={styles.concededLabel}>
            Played
          </ThemedText>
        </View>
        <View style={styles.concededItem}>
          <ThemedText type="h3" style={[styles.concededValue, { color: AppColors.redCard }]}>
            {goalsConceded.totalConceded}
          </ThemedText>
          <ThemedText type="caption" style={styles.concededLabel}>
            Conceded
          </ThemedText>
        </View>
        <View style={styles.concededItem}>
          <ThemedText type="h3" style={[styles.concededValue, { color: AppColors.textSecondary }]}>
            {goalsConceded.avgPerGame.toFixed(1)}
          </ThemedText>
          <ThemedText type="caption" style={styles.concededLabel}>
            Per Game
          </ThemedText>
        </View>
        <View style={styles.concededItem}>
          <ThemedText type="h3" style={[styles.concededValue, { color: AppColors.pitchGreen }]}>
            {goalsConceded.cleanSheets}
          </ThemedText>
          <ThemedText type="caption" style={styles.concededLabel}>
            Clean Sheets
          </ThemedText>
        </View>
      </View>
    </Card>
  );

  const renderGoalsScored = () => (
    <Card elevation={1} style={styles.tableCard}>
      <ThemedText type="h4" style={styles.tableTitle}>
        Goals Scored
      </ThemedText>
      <View style={styles.concededGrid}>
        <View style={styles.concededItem}>
          <ThemedText type="h3" style={styles.concededValue}>
            {goalsScored.matchesPlayed}
          </ThemedText>
          <ThemedText type="caption" style={styles.concededLabel}>
            Played
          </ThemedText>
        </View>
        <View style={styles.concededItem}>
          <ThemedText type="h3" style={[styles.concededValue, { color: AppColors.pitchGreen }]}>
            {goalsScored.totalScored}
          </ThemedText>
          <ThemedText type="caption" style={styles.concededLabel}>
            Scored
          </ThemedText>
        </View>
        <View style={styles.concededItem}>
          <ThemedText type="h3" style={[styles.concededValue, { color: AppColors.textSecondary }]}>
            {goalsScored.avgPerGame.toFixed(1)}
          </ThemedText>
          <ThemedText type="caption" style={styles.concededLabel}>
            Per Game
          </ThemedText>
        </View>
        <View style={styles.concededItem}>
          <ThemedText type="h3" style={[styles.concededValue, { color: AppColors.redCard }]}>
            {goalsScored.blankGames}
          </ThemedText>
          <ThemedText type="caption" style={styles.concededLabel}>
            Blanks
          </ThemedText>
        </View>
      </View>
    </Card>
  );

  const renderCardsTable = () => (
    <Card elevation={1} style={styles.tableCard}>
      <ThemedText type="h4" style={styles.tableTitle}>
        Cards Received
      </ThemedText>
      {cardsReceived.length === 0 ? (
        <ThemedText type="small" style={styles.noDataText}>
          No cards recorded
        </ThemedText>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.rankCell]}>
              #
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.playerCell]}>
              Player
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.cardCell]}>
              Y
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.cardCell]}>
              R
            </ThemedText>
          </View>
          {cardsReceived.map((item: any, index) => (
            <View key={item.playerId} style={styles.tableRow}>
              <ThemedText type="body" style={[styles.tableCell, styles.rankCell]}>
                {index + 1}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.playerCell]} numberOfLines={1}>
                {item.squadNumber ? `${item.squadNumber}. ` : ""}{item.playerName}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.cardCell, { color: AppColors.warningYellow }]}>
                {item.yellowCards}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.cardCell, { color: AppColors.redCard }]}>
                {item.redCards}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  const renderMinutesTable = () => (
    <Card elevation={1} style={styles.tableCard}>
      <ThemedText type="h4" style={styles.tableTitle}>
        Minutes Played
      </ThemedText>
      {playerMinutes.length === 0 ? (
        <ThemedText type="small" style={styles.noDataText}>
          No data available
        </ThemedText>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.rankCell]}>
              #
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.playerCell]}>
              Player
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.valueCell]}>
              Mins
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.cardCell]}>
              MP
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.avgCell]}>
              Avg
            </ThemedText>
          </View>
          {playerMinutes.map((item, index) => (
            <View key={item.playerId} style={styles.tableRow}>
              <ThemedText type="body" style={[styles.tableCell, styles.rankCell]}>
                {index + 1}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.playerCell]} numberOfLines={1}>
                {item.squadNumber ? `${item.squadNumber}. ` : ""}{item.playerName}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.valueCell]}>
                {item.count}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.cardCell]}>
                {item.matches}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.avgCell, { color: AppColors.textSecondary }]}>
                {item.avgPerGame}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText type="body">Loading stats...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!isElite) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.lockedContainer, { paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl }]}>
          <View style={styles.lockedIcon}>
            <Feather name="lock" size={48} color={AppColors.pitchGreen} />
          </View>
          <ThemedText type="h3" style={styles.lockedTitle}>
            Advanced Stats
          </ThemedText>
          <ThemedText type="body" style={styles.lockedText}>
            Detailed match statistics and performance insights will be available soon.
          </ThemedText>
          <View style={styles.lockedFeatures}>
            <View style={styles.lockedFeatureItem}>
              <Feather name="check" size={18} color={AppColors.pitchGreen} />
              <ThemedText type="body" style={styles.lockedFeatureText}>Results breakdown</ThemedText>
            </View>
            <View style={styles.lockedFeatureItem}>
              <Feather name="check" size={18} color={AppColors.pitchGreen} />
              <ThemedText type="body" style={styles.lockedFeatureText}>Goal source analysis</ThemedText>
            </View>
            <View style={styles.lockedFeatureItem}>
              <Feather name="check" size={18} color={AppColors.pitchGreen} />
              <ThemedText type="body" style={styles.lockedFeatureText}>Top scorers and assists</ThemedText>
            </View>
            <View style={styles.lockedFeatureItem}>
              <Feather name="check" size={18} color={AppColors.pitchGreen} />
              <ThemedText type="body" style={styles.lockedFeatureText}>Minutes played tracking</ThemedText>
            </View>
          </View>
          
          <View style={styles.comingSoonContainer}>
            <View style={styles.comingSoonHeader}>
              <Feather name="clock" size={16} color={AppColors.pitchGreen} />
              <ThemedText type="body" style={{ color: AppColors.pitchGreen, fontWeight: '600' }}>
                Coming Soon
              </ThemedText>
            </View>
            
            {showCodeInput ? (
              <View style={styles.codeInputContainer}>
                <ThemedText type="small" style={{ color: AppColors.textSecondary, marginBottom: Spacing.sm }}>
                  Enter early access code
                </ThemedText>
                <TextInput
                  style={styles.codeInput}
                  placeholder="Enter code"
                  placeholderTextColor={AppColors.textSecondary}
                  value={codeValue}
                  onChangeText={(text) => {
                    setCodeValue(text);
                    setCodeError('');
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {codeError ? (
                  <ThemedText type="small" style={styles.codeError}>
                    {codeError}
                  </ThemedText>
                ) : null}
                <View style={styles.codeButtonsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.codeCancelButton,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={() => {
                      setShowCodeInput(false);
                      setCodeValue('');
                      setCodeError('');
                    }}
                  >
                    <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                      Cancel
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.codeSubmitButton,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={handleCodeSubmit}
                  >
                    <ThemedText type="small" style={{ color: '#FFFFFF' }}>
                      Unlock
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.earlyAccessButton,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => setShowCodeInput(true)}
              >
                <Feather name="unlock" size={14} color={AppColors.pitchGreen} />
                <ThemedText type="small" style={{ color: AppColors.pitchGreen }}>
                  Have an early access code?
                </ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <ThemedText type="h2" style={styles.screenTitle}>
            Statistics
          </ThemedText>
          {isElite ? (
            <Pressable
              style={({ pressed }) => [
                styles.exportButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleExportPDF}
            >
              <Feather name="download" size={18} color="#FFFFFF" />
              <ThemedText type="small" style={styles.exportButtonText}>
                Export
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {teams.length > 1 ? (
          <View style={styles.teamSelectorContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.teamSelectorScroll}
            >
              {teams.map((team) => (
                <Pressable
                  key={team.id}
                  style={[
                    styles.teamSelectorButton,
                    selectedTeamId === team.id && styles.teamSelectorButtonActive,
                    team.isArchived && styles.teamSelectorButtonArchived,
                  ]}
                  onPress={() => setSelectedTeamId(team.id)}
                >
                  <ThemedText
                    type="small"
                    style={[
                      styles.teamSelectorText,
                      selectedTeamId === team.id && styles.teamSelectorTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {team.name}{team.isArchived ? " (Archived)" : ""}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {isElite ? renderDateFilters() : null}
        
        {renderFilterButtons()}

        <ThemedText type="small" style={styles.matchCount}>
          {filteredMatches.length} completed {filteredMatches.length === 1 ? "match" : "matches"}
        </ThemedText>

        <Card elevation={1} style={styles.chartCard}>
          <ThemedText type="h4" style={styles.chartTitle}>
            Results
          </ThemedText>
          {renderPieChart([
            { value: resultsData.wins, color: AppColors.pitchGreen, label: "Wins" },
            { value: resultsData.draws, color: "#666666", label: "Draws" },
            { value: resultsData.losses, color: AppColors.redCard, label: "Losses" },
          ])}
        </Card>

        <Card elevation={1} style={styles.chartCard}>
          <ThemedText type="h4" style={styles.chartTitle}>
            Goal Sources
          </ThemedText>
          {renderPieChart([
            { value: goalsData.openPlay, color: AppColors.pitchGreen, label: "Open Play" },
            { value: goalsData.corner, color: "#3a5a8a", label: "Corner" },
            { value: goalsData.freeKick, color: "#6a4a8a", label: "Free Kick" },
            { value: goalsData.penalty, color: "#f57c00", label: "Penalty" },
          ])}
        </Card>

        {renderGoalsScored()}
        {renderGoalsConceded()}
        {renderTable("Top Scorers", topScorers, "Goals")}
        {renderTable("Top Assists", topAssists, "Assists")}
        {renderCardsTable()}
        {renderMinutesTable()}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  lockedContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    paddingHorizontal: Spacing.xl 
  },
  lockedIcon: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: AppColors.surface, 
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: Spacing.xl 
  },
  lockedTitle: { 
    textAlign: "center", 
    marginBottom: Spacing.md 
  },
  lockedText: { 
    textAlign: "center", 
    color: AppColors.textSecondary, 
    marginBottom: Spacing.xl 
  },
  lockedFeatures: { 
    marginBottom: Spacing.xl, 
    width: "100%" 
  },
  lockedFeatureItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: Spacing.sm, 
    gap: Spacing.sm 
  },
  lockedFeatureText: { 
    color: AppColors.textSecondary 
  },
  upgradeButton: { 
    backgroundColor: AppColors.pitchGreen, 
    paddingVertical: Spacing.md, 
    paddingHorizontal: Spacing.xl, 
    borderRadius: BorderRadius.md 
  },
  upgradeButtonText: { 
    color: "#FFFFFF", 
    fontWeight: "700" 
  },
  scrollContent: { paddingHorizontal: Spacing.lg },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  screenTitle: { flex: 1 },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: AppColors.pitchGreen,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  exportButtonText: { color: "#FFFFFF", fontWeight: "600" },
  teamSelectorContainer: { marginBottom: Spacing.md },
  teamSelectorScroll: { gap: Spacing.sm },
  teamSelectorButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.elevated,
  },
  teamSelectorButtonActive: {
    backgroundColor: AppColors.pitchGreen,
    borderColor: AppColors.pitchGreen,
  },
  teamSelectorButtonArchived: {
    borderStyle: "dashed",
    opacity: 0.7,
  },
  teamSelectorText: { color: AppColors.textSecondary },
  teamSelectorTextActive: { color: "#FFFFFF", fontWeight: "600" },
  filterRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  filterButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    backgroundColor: AppColors.elevated,
  },
  filterButtonActive: { backgroundColor: AppColors.pitchGreen },
  filterButtonText: { color: AppColors.textSecondary },
  filterButtonTextActive: { color: "#FFFFFF" },
  matchCount: { color: AppColors.textSecondary, marginBottom: Spacing.lg },
  chartCard: { marginBottom: Spacing.lg, padding: Spacing.lg },
  chartTitle: { marginBottom: Spacing.md },
  pieChartContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pieChart: { justifyContent: "center", alignItems: "center" },
  pieChartCenter: { position: "absolute", justifyContent: "center", alignItems: "center" },
  pieLegend: { flex: 1, marginLeft: Spacing.lg },
  legendItem: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.xs },
  legendText: { color: AppColors.textSecondary },
  tableCard: { marginBottom: Spacing.lg, padding: Spacing.lg },
  tableTitle: { marginBottom: Spacing.md },
  noDataText: { color: AppColors.textSecondary, textAlign: "center", paddingVertical: Spacing.md },
  table: { borderRadius: BorderRadius.xs, overflow: "hidden" },
  tableHeader: { flexDirection: "row", backgroundColor: AppColors.elevated, paddingVertical: Spacing.sm },
  tableHeaderCell: { color: AppColors.textSecondary, fontWeight: "600" },
  tableRow: { flexDirection: "row", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: AppColors.elevated },
  tableCell: { color: "#FFFFFF" },
  rankCell: { width: 30, textAlign: "center" },
  playerCell: { flex: 1, paddingRight: Spacing.sm },
  valueCell: { width: 50, textAlign: "center" },
  cardCell: { width: 30, textAlign: "center" },
  avgCell: { width: 40, textAlign: "center" },
  concededGrid: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    flexWrap: "wrap" 
  },
  concededItem: { 
    alignItems: "center", 
    minWidth: 70, 
    paddingVertical: Spacing.sm 
  },
  concededValue: { 
    textAlign: "center" 
  },
  concededLabel: { 
    color: AppColors.textSecondary, 
    textAlign: "center", 
    marginTop: Spacing.xs 
  },
  dateFilterContainer: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  dateFilterLabel: {
    color: AppColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  dateButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  dateButtonText: {
    color: "#FFFFFF",
  },
  dateSeparator: {
    color: AppColors.textSecondary,
    marginHorizontal: Spacing.sm,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  datePickerModal: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    paddingBottom: Spacing.xl,
  },
  datePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.elevated,
  },
  datePickerTitle: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  datePickerDone: {
    color: AppColors.pitchGreen,
    fontWeight: "600",
  },
  comingSoonContainer: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: AppColors.elevated,
    paddingTop: Spacing.lg,
    width: "100%",
  },
  comingSoonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  codeInputContainer: {
    gap: Spacing.md,
  },
  codeInput: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: '#FFFFFF',
    fontSize: 16,
  },
  codeError: {
    color: AppColors.redCard,
    textAlign: 'center',
  },
  codeButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  codeCancelButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  codeSubmitButton: {
    backgroundColor: AppColors.pitchGreen,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  earlyAccessButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: AppColors.pitchGreen,
    borderRadius: BorderRadius.md,
    borderStyle: "dashed",
  },
});
