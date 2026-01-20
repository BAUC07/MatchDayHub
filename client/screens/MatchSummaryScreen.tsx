import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { HeaderButton } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Match, Team, Player, MatchEvent } from "@/types";
import { getMatch, getTeam } from "@/lib/storage";
import { formatMatchTime, formatDate, getMatchResult, countYellowCards, countRedCards } from "@/lib/utils";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MatchSummaryRouteProp = RouteProp<RootStackParamList, "MatchSummary">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function MatchSummaryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MatchSummaryRouteProp>();

  const [match, setMatch] = useState<Match | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

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

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton onPress={handleDone}>
          <ThemedText
            type="body"
            style={{ color: AppColors.pitchGreen, fontWeight: "600" }}
          >
            Done
          </ThemedText>
        </HeaderButton>
      ),
    });
  }, [navigation, handleDone]);

  const getPlayerName = useCallback(
    (id?: string) => {
      if (!id || !team) return "";
      const player = team.players.find((p) => p.id === id);
      return player?.name || "Unknown";
    },
    [team]
  );

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
  const penalties = match.events.filter((e) => e.type === "penalty").length;

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
            <ThemedText type="body" numberOfLines={2} style={styles.teamName}>
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
            <ThemedText type="body" numberOfLines={2} style={styles.teamName}>
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
              {formatMatchTime(match.totalMatchTime)}
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

      <ThemedText type="h4" style={styles.sectionTitle}>
        Timeline
      </ThemedText>

      <Card elevation={2} style={styles.timelineCard}>
        <View style={styles.timelineAxis}>
          <View style={styles.timelineBar}>
            {match.events.map((event, index) => {
              const position =
                (event.timestamp / Math.max(match.totalMatchTime, 1)) * 100;
              return (
                <View
                  key={event.id}
                  style={[
                    styles.timelineMarker,
                    { left: `${Math.min(position, 95)}%` },
                  ]}
                >
                  {event.type === "goal_for" ? (
                    <Feather name="target" size={12} color={AppColors.pitchGreen} />
                  ) : event.type === "goal_against" ? (
                    <Feather name="target" size={12} color={AppColors.redCard} />
                  ) : event.type === "card" ? (
                    <View
                      style={[
                        styles.timelineCardIcon,
                        {
                          backgroundColor:
                            event.cardType === "yellow"
                              ? AppColors.warningYellow
                              : AppColors.redCard,
                        },
                      ]}
                    />
                  ) : event.type === "substitution" ? (
                    <Feather
                      name="refresh-cw"
                      size={12}
                      color={AppColors.textSecondary}
                    />
                  ) : (
                    <Feather name="circle" size={12} color={AppColors.warningYellow} />
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.timeLabels}>
            <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
              0'
            </ThemedText>
            <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
              {Math.floor(match.totalMatchTime / 60)}'
            </ThemedText>
          </View>
        </View>

        {match.events.length === 0 ? (
          <View style={styles.noEvents}>
            <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
              No events recorded
            </ThemedText>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {match.events.map((event) => (
              <View key={event.id} style={styles.eventItem}>
                <ThemedText type="caption" style={styles.eventTime}>
                  {formatMatchTime(event.timestamp)}
                </ThemedText>
                {event.type === "goal_for" ? (
                  <>
                    <Feather name="target" size={14} color={AppColors.pitchGreen} />
                    <ThemedText type="small">
                      Goal: {getPlayerName(event.playerId)}
                    </ThemedText>
                  </>
                ) : event.type === "goal_against" ? (
                  <>
                    <Feather name="target" size={14} color={AppColors.redCard} />
                    <ThemedText type="small">
                      Goal conceded ({event.goalType?.replace("_", " ")})
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
                    <ThemedText type="small">
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
                    <ThemedText type="small">
                      {getPlayerName(event.playerOnId)} on for{" "}
                      {getPlayerName(event.playerOffId)}
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <Feather name="circle" size={14} color={AppColors.warningYellow} />
                    <ThemedText type="small">
                      Penalty {event.isForTeam ? "for" : "against"}:{" "}
                      {event.penaltyOutcome}
                    </ThemedText>
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </Card>
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
    height: 48,
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
  },
  timelineAxis: {
    marginBottom: Spacing.lg,
  },
  timelineBar: {
    height: 40,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.xs,
    position: "relative",
    marginBottom: Spacing.sm,
  },
  timelineMarker: {
    position: "absolute",
    top: "50%",
    marginTop: -10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineCardIcon: {
    width: 8,
    height: 12,
    borderRadius: 1,
  },
  timeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
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
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.elevated,
  },
  eventTime: {
    width: 50,
    color: AppColors.textSecondary,
  },
  eventCardIcon: {
    width: 10,
    height: 14,
    borderRadius: 2,
  },
});
