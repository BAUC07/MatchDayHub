import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { HeaderButton } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Match, Team, MatchEvent } from "@/types";
import { getMatch, getTeam } from "@/lib/storage";
import { formatMatchTime, formatDate, getMatchResult, countYellowCards, countRedCards, formatTimeWithAdded, formatTotalGameTime } from "@/lib/utils";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MatchSummaryRouteProp = RouteProp<RootStackParamList, "MatchSummary">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PlayerTimeStats {
  playerId: string;
  playerName: string;
  timeOnPitch: number;
  timeOffPitch: number;
}

export default function MatchSummaryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MatchSummaryRouteProp>();
  const viewShotRef = useRef<ViewShot>(null);

  const [match, setMatch] = useState<Match | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubstitutions, setShowSubstitutions] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const matchData = await getMatch(route.params.matchId);
      if (matchData) {
        setMatch(matchData);
        const teamData = await getTeam(matchData.teamId);
        setTeam(teamData);
      }
    } catch (error) {
      console.error("Error loading match:", error);
    } finally {
      setLoading(false);
    }
  }, [route.params.matchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.popToTop();
  }, [navigation]);

  const handleShare = useCallback(async () => {
    if (!viewShotRef.current) return;
    
    try {
      setIsSharing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const uri = await viewShotRef.current.capture?.();
      if (uri) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: "image/png",
            dialogTitle: "Share Match Summary",
          });
        }
      }
    } catch (error) {
      console.error("Error sharing:", error);
    } finally {
      setIsSharing(false);
    }
  }, []);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", gap: Spacing.md }}>
          <HeaderButton onPress={handleShare}>
            <Feather name="share" size={20} color={AppColors.pitchGreen} />
          </HeaderButton>
          <HeaderButton onPress={handleDone}>
            <ThemedText
              type="body"
              style={{ color: AppColors.pitchGreen, fontWeight: "600" }}
            >
              Done
            </ThemedText>
          </HeaderButton>
        </View>
      ),
    });
  }, [navigation, handleDone, handleShare]);

  const getPlayerName = useCallback(
    (id?: string) => {
      if (!id || !team) return "";
      const player = team.players.find((p) => p.id === id);
      return player?.name || "Unknown";
    },
    [team]
  );

  const formatTimeWithHalves = useCallback((match: Match) => {
    const totalMinutes = Math.floor(match.totalMatchTime / 60);
    const plannedHalf = (match.plannedDuration || 90) / 2;
    
    const firstHalfAdded = match.firstHalfAddedTime || 0;
    const secondHalfAdded = match.secondHalfAddedTime || 0;
    
    const firstHalfBase = Math.floor(plannedHalf);
    const secondHalfBase = Math.floor(plannedHalf);
    
    const firstHalfAddedMins = Math.floor(firstHalfAdded / 60);
    const secondHalfAddedMins = Math.floor(secondHalfAdded / 60);
    
    let result = `${totalMinutes}'`;
    
    if (firstHalfAdded > 0 || secondHalfAdded > 0) {
      const firstHalfStr = firstHalfAddedMins > 0 
        ? `${firstHalfBase}'+${firstHalfAddedMins}` 
        : `${firstHalfBase}'`;
      const secondHalfStr = secondHalfAddedMins > 0 
        ? `${secondHalfBase}'+${secondHalfAddedMins}` 
        : `${secondHalfBase}'`;
      result += ` (${firstHalfStr} / ${secondHalfStr})`;
    }
    
    return result;
  }, []);

  const filteredEvents = useMemo(() => {
    if (!match) return [];
    return match.events.filter(event => {
      if (!showSubstitutions && event.type === "substitution") {
        return false;
      }
      return true;
    });
  }, [match, showSubstitutions]);

  const playerTimeStats = useMemo((): PlayerTimeStats[] => {
    if (!match || !team) return [];
    
    const totalTime = match.totalMatchTime;
    const stats: Map<string, { timeOnPitch: number; lastOnTime: number; isOnPitch: boolean }> = new Map();
    
    const allPlayerIds = [...match.startingLineup, ...match.substitutes];
    
    allPlayerIds.forEach(playerId => {
      const isStarter = match.startingLineup.includes(playerId);
      stats.set(playerId, {
        timeOnPitch: 0,
        lastOnTime: isStarter ? 0 : -1,
        isOnPitch: isStarter,
      });
    });
    
    // Process substitutions and red cards chronologically
    const sortedEvents = [...match.events]
      .filter(e => e.type === "substitution" || e.type === "card")
      .sort((a, b) => a.timestamp - b.timestamp);
    
    sortedEvents.forEach(event => {
      if (event.type === "substitution") {
        // Player going off
        if (event.playerOffId) {
          const playerOff = stats.get(event.playerOffId);
          if (playerOff && playerOff.isOnPitch) {
            playerOff.timeOnPitch += event.timestamp - playerOff.lastOnTime;
            playerOff.isOnPitch = false;
          }
        }
        
        // Player coming on
        if (event.playerOnId) {
          const playerOn = stats.get(event.playerOnId);
          if (playerOn) {
            playerOn.lastOnTime = event.timestamp;
            playerOn.isOnPitch = true;
          }
        }
      } else if (event.type === "card" && event.cardType === "red" && event.playerId) {
        // Red card - player is sent off, stop accruing minutes
        const player = stats.get(event.playerId);
        if (player && player.isOnPitch) {
          player.timeOnPitch += event.timestamp - player.lastOnTime;
          player.isOnPitch = false;
        }
      }
    });
    
    // Add remaining time for players still on pitch at end of match
    stats.forEach((stat) => {
      if (stat.isOnPitch && stat.lastOnTime >= 0) {
        stat.timeOnPitch += totalTime - stat.lastOnTime;
      }
    });
    
    return allPlayerIds.map(playerId => ({
      playerId,
      playerName: getPlayerName(playerId),
      timeOnPitch: stats.get(playerId)?.timeOnPitch || 0,
      timeOffPitch: totalTime - (stats.get(playerId)?.timeOnPitch || 0),
    })).sort((a, b) => b.timeOnPitch - a.timeOnPitch);
  }, [match, team, getPlayerName]);

  if (loading || !match || !team) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
            Loading...
          </ThemedText>
        </View>
      </View>
    );
  }

  const result = getMatchResult(match);
  const resultColor =
    result === "win"
      ? AppColors.pitchGreen
      : result === "loss"
        ? AppColors.redCard
        : AppColors.warningYellow;
  const resultText =
    result === "win" ? "Victory" : result === "loss" ? "Defeat" : "Draw";

  const yellowCards = countYellowCards(match.events);
  const redCards = countRedCards(match.events);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <ViewShot
        ref={viewShotRef}
        options={{ format: "png", quality: 1, result: "tmpfile" }}
        style={{ backgroundColor: theme.backgroundRoot }}
      >
        <Card elevation={2} style={styles.scoreCard}>
          <View style={[styles.resultBadge, { backgroundColor: resultColor }]}>
            <ThemedText type="small" style={styles.resultText}>
              {resultText}
            </ThemedText>
          </View>

          <View style={styles.matchInfo}>
            <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
              {formatDate(match.date)} - {match.location === "home" ? "Home" : "Away"}
            </ThemedText>
          </View>

          <View style={styles.scoreContainer}>
            <View style={styles.teamSide}>
              <ThemedText type="body" style={styles.teamName}>
                {team.name}
              </ThemedText>
              <ThemedText type="hero" style={[styles.score, { color: resultColor }]}>
                {match.scoreFor}
              </ThemedText>
            </View>

            <View style={styles.vs}>
              <ThemedText type="h4" style={{ color: AppColors.textDisabled }}>
                -
              </ThemedText>
            </View>

            <View style={[styles.teamSide, styles.teamSideRight]}>
              <ThemedText type="body" style={styles.teamName}>
                {match.opposition}
              </ThemedText>
              <ThemedText type="hero" style={styles.score}>
                {match.scoreAgainst}
              </ThemedText>
            </View>
          </View>

          <View style={styles.matchMeta}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={AppColors.textSecondary} />
              <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                {formatTimeWithHalves(match)}
              </ThemedText>
            </View>
            <View style={styles.metaItem}>
              <Feather name="users" size={14} color={AppColors.textSecondary} />
              <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                {match.format}
              </ThemedText>
            </View>
          </View>
        </Card>

        <ThemedText type="h4" style={styles.sectionTitle}>
          Match Stats
        </ThemedText>

        <View style={styles.statsGrid}>
          <Card elevation={2} style={styles.statCard}>
            <Feather name="target" size={24} color={AppColors.pitchGreen} />
            <ThemedText type="h3">{match.scoreFor}</ThemedText>
            <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
              Goals Scored
            </ThemedText>
          </Card>

          <Card elevation={2} style={styles.statCard}>
            <Feather name="target" size={24} color={AppColors.redCard} />
            <ThemedText type="h3">{match.scoreAgainst}</ThemedText>
            <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
              Goals Conceded
            </ThemedText>
          </Card>

          <Card elevation={2} style={styles.statCard}>
            <View
              style={[styles.cardIcon, { backgroundColor: AppColors.warningYellow }]}
            />
            <ThemedText type="h3">{yellowCards}</ThemedText>
            <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
              Yellow Cards
            </ThemedText>
          </Card>

          <Card elevation={2} style={styles.statCard}>
            <View style={[styles.cardIcon, { backgroundColor: AppColors.redCard }]} />
            <ThemedText type="h3">{redCards}</ThemedText>
            <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
              Red Cards
            </ThemedText>
          </Card>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="h4" style={styles.sectionTitleInline}>
            Timeline
          </ThemedText>
          <Pressable
            style={styles.filterButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSubstitutions(!showSubstitutions);
            }}
          >
            <Feather 
              name={showSubstitutions ? "eye" : "eye-off"} 
              size={16} 
              color={AppColors.textSecondary} 
            />
            <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
              Subs
            </ThemedText>
          </Pressable>
        </View>

        <Card elevation={2} style={styles.timelineCard}>
          <View style={styles.eventsList}>
            {/* Kick Off */}
            <View style={styles.eventItem}>
              <ThemedText type="caption" style={styles.eventTime}>
                KO
              </ThemedText>
              <Feather name="play" size={14} color={AppColors.pitchGreen} />
              <ThemedText type="small" style={styles.eventDescription}>
                Kick Off
              </ThemedText>
            </View>

            {/* Match Events with Half Time insertion */}
            {(() => {
              const plannedHalf = ((match.plannedDuration || 90) / 2) * 60;
              const firstHalfAdded = match.firstHalfAddedTime || 0;
              const halfTimePoint = match.halfTimeMatchTime || (plannedHalf + firstHalfAdded);
              let htShown = false;
              
              const elements: React.ReactNode[] = [];
              
              filteredEvents.forEach((event, index) => {
                const isAfterHT = event.timestamp > halfTimePoint;
                
                // Show HT entry before the first second-half event
                if (match.halfTimeTriggered && isAfterHT && !htShown) {
                  htShown = true;
                  elements.push(
                    <View key="halftime" style={styles.eventItem}>
                      <ThemedText type="caption" style={styles.eventTime}>
                        {match.halfTimeMatchTime 
                          ? formatTimeWithAdded(match.halfTimeMatchTime, match.plannedDuration || 90, false)
                          : "HT"}
                      </ThemedText>
                      <Feather name="pause" size={14} color={AppColors.textSecondary} />
                      <ThemedText type="small" style={styles.eventDescription}>
                        Half Time
                      </ThemedText>
                    </View>
                  );
                }
                
                elements.push(
                  <View key={event.id} style={styles.eventItem}>
                    <ThemedText type="caption" style={styles.eventTime}>
                      {formatMatchTime(event.timestamp)}
                    </ThemedText>
                    {event.type === "goal_for" ? (
                      <>
                        <Feather name="target" size={14} color={AppColors.pitchGreen} />
                        <ThemedText type="small" style={styles.eventDescription}>
                          Goal: {getPlayerName(event.playerId)}
                          {event.assistPlayerId ? ` (assist: ${getPlayerName(event.assistPlayerId)})` : ""}
                          {event.goalType ? ` - ${event.goalType.replace("_", " ")}` : ""}
                        </ThemedText>
                      </>
                    ) : event.type === "goal_against" ? (
                      <>
                        <Feather name="target" size={14} color={AppColors.redCard} />
                        <ThemedText type="small" style={styles.eventDescription}>
                          Goal conceded{event.goalType ? ` (${event.goalType.replace("_", " ")})` : ""}
                        </ThemedText>
                      </>
                    ) : event.type === "card" ? (
                      <>
                        <View
                          style={[
                            styles.eventCardIcon,
                            {
                              backgroundColor:
                                event.cardType === "yellow"
                                  ? AppColors.warningYellow
                                  : AppColors.redCard,
                            },
                          ]}
                        />
                        <ThemedText type="small" style={styles.eventDescription}>
                          {event.cardType === "yellow" ? "Yellow" : "Red"} card:{" "}
                          {getPlayerName(event.playerId)}
                        </ThemedText>
                      </>
                    ) : event.type === "substitution" ? (
                      <>
                        <Feather
                          name="refresh-cw"
                          size={14}
                          color={AppColors.textSecondary}
                        />
                        <ThemedText type="small" style={styles.eventDescription}>
                          {getPlayerName(event.playerOnId)} on for{" "}
                          {getPlayerName(event.playerOffId)}
                        </ThemedText>
                      </>
                    ) : (
                      <>
                        <Feather name="circle" size={14} color={AppColors.warningYellow} />
                        <ThemedText type="small" style={styles.eventDescription}>
                          Penalty {event.isForTeam ? "for" : "against"}:{" "}
                          {event.penaltyOutcome}
                        </ThemedText>
                      </>
                    )}
                  </View>
                );
              });
              
              // If HT was triggered but not shown (all events before HT or no second half events)
              if (match.halfTimeTriggered && !htShown) {
                elements.push(
                  <View key="halftime" style={styles.eventItem}>
                    <ThemedText type="caption" style={styles.eventTime}>
                      {match.halfTimeMatchTime 
                        ? formatTimeWithAdded(match.halfTimeMatchTime, match.plannedDuration || 90, false)
                        : "HT"}
                    </ThemedText>
                    <Feather name="pause" size={14} color={AppColors.textSecondary} />
                    <ThemedText type="small" style={styles.eventDescription}>
                      Half Time
                    </ThemedText>
                  </View>
                );
              }
              
              return elements;
            })()}

            {/* Full Time */}
            {match.isCompleted ? (
              <View style={styles.eventItem}>
                <ThemedText type="caption" style={styles.eventTime}>
                  {match.endMatchTime 
                    ? formatTimeWithAdded(
                        match.endMatchTime, 
                        match.plannedDuration || 90, 
                        match.halfTimeTriggered || false, 
                        match.firstHalfAddedTime || 0
                      )
                    : "FT"}
                </ThemedText>
                <Feather name="flag" size={14} color={AppColors.pitchGreen} />
                <ThemedText type="small" style={styles.eventDescription}>
                  Full Time
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* Total Game Time */}
          {match.isCompleted ? (
            <View style={styles.totalTimeContainer}>
              <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
                Total Game Time:
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {formatTotalGameTime(
                  match.totalMatchTime,
                  match.plannedDuration || 90,
                  match.firstHalfAddedTime || 0,
                  match.secondHalfAddedTime || 0
                )}
              </ThemedText>
            </View>
          ) : null}
        </Card>

        <ThemedText type="h4" style={styles.sectionTitle}>
          Playing Time
        </ThemedText>

        <Card elevation={2} style={styles.playingTimeCard}>
          <View style={styles.playingTimeHeader}>
            <ThemedText type="caption" style={[styles.playingTimeCol, { flex: 2 }]}>
              Player
            </ThemedText>
            <ThemedText type="caption" style={styles.playingTimeCol}>
              On Pitch
            </ThemedText>
            <ThemedText type="caption" style={styles.playingTimeCol}>
              Off Pitch
            </ThemedText>
          </View>
          {playerTimeStats.map((stat) => (
            <View key={stat.playerId} style={styles.playingTimeRow}>
              <ThemedText type="small" style={[styles.playingTimePlayerName, { flex: 2 }]}>
                {stat.playerName}
              </ThemedText>
              <ThemedText type="small" style={styles.playingTimeValue}>
                {formatMatchTime(stat.timeOnPitch)}
              </ThemedText>
              <ThemedText type="small" style={[styles.playingTimeValue, { color: AppColors.textSecondary }]}>
                {formatMatchTime(stat.timeOffPitch)}
              </ThemedText>
            </View>
          ))}
          <View style={styles.playingTimeTotalRow}>
            <ThemedText type="small" style={[styles.playingTimePlayerName, { flex: 2, fontWeight: "600" }]}>
              Match Duration
            </ThemedText>
            <ThemedText type="small" style={[styles.playingTimeValue, { fontWeight: "600" }]}>
              {formatMatchTime(match.totalMatchTime)}
            </ThemedText>
            <ThemedText type="small" style={styles.playingTimeValue}>
              
            </ThemedText>
          </View>
        </Card>
      </ViewShot>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreCard: {
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  resultBadge: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  resultText: {
    color: "#FFFFFF",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  matchInfo: {
    marginBottom: Spacing.lg,
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    width: "100%",
    marginBottom: Spacing.lg,
  },
  teamSide: {
    flex: 1,
    alignItems: "center",
  },
  teamSideRight: {
    alignItems: "center",
  },
  teamName: {
    textAlign: "center",
    marginBottom: Spacing.sm,
    minHeight: 48,
    flexWrap: "wrap",
  },
  score: {
    fontWeight: "700",
  },
  vs: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 52,
  },
  matchMeta: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  sectionTitleInline: {
    marginBottom: 0,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2 - 1,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  cardIcon: {
    width: 20,
    height: 28,
    borderRadius: 3,
  },
  timelineCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  noEvents: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  eventsList: {
    gap: Spacing.sm,
  },
  eventItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.elevated,
  },
  eventTime: {
    width: 50,
    color: AppColors.textSecondary,
  },
  eventDescription: {
    flex: 1,
    flexWrap: "wrap",
  },
  eventCardIcon: {
    width: 10,
    height: 14,
    borderRadius: 2,
    marginTop: 2,
  },
  totalTimeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: AppColors.elevated,
  },
  playingTimeCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  playingTimeHeader: {
    flexDirection: "row",
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.elevated,
    marginBottom: Spacing.sm,
  },
  playingTimeCol: {
    flex: 1,
    color: AppColors.textSecondary,
    textAlign: "center",
  },
  playingTimeRow: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.elevated,
  },
  playingTimePlayerName: {
    flex: 1,
  },
  playingTimeValue: {
    flex: 1,
    textAlign: "center",
  },
  playingTimeTotalRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
    backgroundColor: AppColors.elevated,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: -Spacing.lg,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
});
