import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Image,
  RefreshControl,
  Pressable,
  Modal,
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
  const [showTeamPicker, setShowTeamPicker] = useState(false);

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

  const handleNewMatch = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (teams.length === 0) {
      return;
    } else if (teams.length === 1) {
      navigation.navigate("MatchSetup", { teamId: teams[0].id });
    } else {
      setShowTeamPicker(true);
    }
  }, [teams, navigation]);

  const handleSelectTeam = useCallback(
    (team: Team) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowTeamPicker(false);
      navigation.navigate("MatchSetup", { teamId: team.id });
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

  const renderNewMatchCard = useCallback(
    () => (
      <Pressable
        style={({ pressed }) => [
          styles.newMatchCard,
          { opacity: pressed ? 0.8 : 1 },
          teams.length === 0 && styles.newMatchCardDisabled,
        ]}
        onPress={handleNewMatch}
        disabled={teams.length === 0}
      >
        <View style={styles.newMatchIcon}>
          <Feather
            name="play-circle"
            size={28}
            color={teams.length > 0 ? AppColors.pitchGreen : AppColors.textDisabled}
          />
        </View>
        <View style={styles.newMatchText}>
          <ThemedText
            type="h4"
            style={{
              color: teams.length > 0 ? theme.text : AppColors.textDisabled,
            }}
          >
            Start New Match
          </ThemedText>
          <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
            {teams.length > 0
              ? "Log a new match in real-time"
              : "Create a team first to start a match"}
          </ThemedText>
        </View>
      </Pressable>
    ),
    [teams.length, handleNewMatch, theme.text]
  );

  const renderMatchCard = useCallback(
    ({ item }: { item: Match }) => {
      const result = getMatchResult(item);
      const resultColor = getResultColor(result);

      return (
        <Pressable
          style={({ pressed }) => [
            styles.matchCard,
            { opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => handleMatchPress(item)}
        >
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
            <ThemedText type="h4" style={{ color: "#FFFFFF", fontWeight: "700" }}>
              {item.location === "home" ? "H" : "A"}
            </ThemedText>
          </View>

          <View style={styles.scoreContainer}>
            <View style={styles.teamScore}>
              <ThemedText type="body" numberOfLines={1} style={styles.teamName}>
                {getTeamName(item.teamId)}
              </ThemedText>
              <ThemedText type="h3" style={[styles.score, { color: resultColor }]}>
                {item.scoreFor}
              </ThemedText>
            </View>
            <ThemedText type="body" style={styles.vs}>
              -
            </ThemedText>
            <View style={[styles.teamScore, styles.teamScoreRight]}>
              <ThemedText type="body" numberOfLines={1} style={styles.teamName}>
                {item.opposition}
              </ThemedText>
              <ThemedText type="h3" style={styles.score}>
                {item.scoreAgainst}
              </ThemedText>
            </View>
          </View>

          <View style={styles.matchMeta}>
            <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
              {item.format}
            </ThemedText>
            {!item.isCompleted ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
              </View>
            ) : null}
          </View>
        </Pressable>
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
          Start your first match to begin logging
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
    <>
      <FlatList
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={renderMatchCard}
        ListHeaderComponent={
          <>
            {renderNewMatchCard()}
            {matches.length === 0 ? renderEmptyState() : null}
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={AppColors.pitchGreen}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <Modal
        visible={showTeamPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeamPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowTeamPicker(false)}
        >
          <View />
        </Pressable>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.modalHandle} />
          <ThemedText type="h4" style={styles.modalTitle}>
            Select Team
          </ThemedText>
          <FlatList
            data={teams}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.teamOption,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => handleSelectTeam(item)}
              >
                <View style={styles.teamOptionIcon}>
                  <Feather name="shield" size={24} color={AppColors.pitchGreen} />
                </View>
                <View style={styles.teamOptionInfo}>
                  <ThemedText type="body">{item.name}</ThemedText>
                  <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                    {item.players.length} players
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={AppColors.textSecondary} />
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.teamSeparator} />}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  newMatchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 2,
    borderColor: AppColors.pitchGreen,
    borderStyle: "dashed",
  },
  newMatchCardDisabled: {
    borderColor: AppColors.textDisabled,
  },
  newMatchIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.elevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.lg,
  },
  newMatchText: {
    flex: 1,
  },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  locationBadge: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  scoreContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  teamScore: {
    flex: 1,
    alignItems: "center",
  },
  teamScoreRight: {
    alignItems: "center",
  },
  teamName: {
    fontSize: 14,
    marginBottom: 2,
  },
  score: {
    fontWeight: "700",
  },
  vs: {
    color: AppColors.textSecondary,
    marginHorizontal: Spacing.sm,
  },
  matchMeta: {
    alignItems: "flex-end",
    marginLeft: Spacing.md,
  },
  liveBadge: {
    marginTop: 4,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.redCard,
  },
  separator: {
    height: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["3xl"],
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    maxHeight: "50%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: AppColors.textDisabled,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  teamOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  teamOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: AppColors.elevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  teamOptionInfo: {
    flex: 1,
  },
  teamSeparator: {
    height: 1,
    backgroundColor: AppColors.elevated,
  },
});
