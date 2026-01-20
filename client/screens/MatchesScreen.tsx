import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Image,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Match, Team } from "@/types";
import { getMatches, getTeams } from "@/lib/storage";
import { formatDate, getMatchResult } from "@/lib/utils";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [matchesData, teamsData] = await Promise.all([
        getMatches(),
        getTeams(),
      ]);
      setMatches(matchesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setTeams(teamsData);
    } catch (error) {
      console.error("Error loading matches:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleMatchPress = useCallback(
    (match: Match) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (match.isCompleted) {
        navigation.navigate("MatchSummary", { matchId: match.id });
      } else {
        navigation.navigate("LiveMatch", { matchId: match.id });
      }
    },
    [navigation]
  );

  const getTeamName = useCallback(
    (teamId: string) => {
      const team = teams.find((t) => t.id === teamId);
      return team?.name || "Unknown Team";
    },
    [teams]
  );

  const getResultColor = (result: ReturnType<typeof getMatchResult>) => {
    switch (result) {
      case "win":
        return AppColors.pitchGreen;
      case "loss":
        return AppColors.redCard;
      case "draw":
        return AppColors.warningYellow;
      default:
        return AppColors.textSecondary;
    }
  };

  const renderMatchCard = useCallback(
    ({ item }: { item: Match }) => {
      const result = getMatchResult(item);
      const resultColor = getResultColor(result);

      return (
        <Card
          elevation={2}
          onPress={() => handleMatchPress(item)}
          style={styles.matchCard}
        >
          <View style={styles.matchHeader}>
            <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
              {formatDate(item.date)}
            </ThemedText>
            <View
              style={[
                styles.locationBadge,
                {
                  backgroundColor:
                    item.location === "home"
                      ? AppColors.pitchGreen
                      : AppColors.elevated,
                },
              ]}
            >
              <ThemedText type="caption" style={{ color: "#FFFFFF" }}>
                {item.location === "home" ? "H" : "A"}
              </ThemedText>
            </View>
          </View>

          <View style={styles.scoreContainer}>
            <View style={styles.teamScore}>
              <ThemedText type="body" numberOfLines={1} style={styles.teamName}>
                {getTeamName(item.teamId)}
              </ThemedText>
              <ThemedText type="h2" style={[styles.score, { color: resultColor }]}>
                {item.scoreFor}
              </ThemedText>
            </View>
            <ThemedText type="h4" style={styles.vs}>
              -
            </ThemedText>
            <View style={[styles.teamScore, styles.teamScoreRight]}>
              <ThemedText type="body" numberOfLines={1} style={styles.teamName}>
                {item.opposition}
              </ThemedText>
              <ThemedText type="h2" style={styles.score}>
                {item.scoreAgainst}
              </ThemedText>
            </View>
          </View>

          <View style={styles.matchFooter}>
            <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
              {item.format}
            </ThemedText>
            {!item.isCompleted ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
                <ThemedText type="caption" style={{ color: AppColors.redCard }}>
                  LIVE
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Card>
      );
    },
    [getTeamName, handleMatchPress]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Image
          source={require("../../assets/images/empty-matches.png")}
          style={styles.emptyImage}
          resizeMode="contain"
        />
        <ThemedText type="h3" style={styles.emptyTitle}>
          No Matches Yet
        </ThemedText>
        <ThemedText type="body" style={styles.emptyText}>
          Start a match from your team's page to begin logging
        </ThemedText>
      </View>
    ),
    []
  );

  if (loading) {
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

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.listContent,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
        matches.length === 0 && styles.emptyListContent,
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={matches}
      keyExtractor={(item) => item.id}
      renderItem={renderMatchCard}
      ListEmptyComponent={renderEmptyState}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={AppColors.pitchGreen}
        />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  matchCard: {
    padding: Spacing.lg,
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  locationBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  teamScore: {
    flex: 1,
  },
  teamScoreRight: {
    alignItems: "flex-end",
  },
  teamName: {
    marginBottom: 4,
  },
  score: {
    fontWeight: "700",
  },
  vs: {
    color: AppColors.textSecondary,
    marginHorizontal: Spacing.lg,
  },
  matchFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.redCard,
  },
  separator: {
    height: Spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyImage: {
    width: 160,
    height: 160,
    marginBottom: Spacing.xl,
    opacity: 0.8,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
    color: AppColors.textSecondary,
  },
});
