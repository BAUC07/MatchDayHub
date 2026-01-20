import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { HeaderButton } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Team, Player } from "@/types";
import { getTeam, deleteTeam as deleteTeamStorage } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TeamDetailRouteProp = RouteProp<RootStackParamList, "TeamDetail">;

export default function TeamDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<TeamDetailRouteProp>();

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTeam = useCallback(async () => {
    try {
      const teamData = await getTeam(route.params.teamId);
      setTeam(teamData);
    } catch (error) {
      console.error("Error loading team:", error);
    } finally {
      setLoading(false);
    }
  }, [route.params.teamId]);

  useFocusEffect(
    useCallback(() => {
      loadTeam();
    }, [loadTeam])
  );

  const handleEditSquad = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("SquadEditor", { teamId: route.params.teamId });
  }, [navigation, route.params.teamId]);

  const handleStartMatch = useCallback(() => {
    if (!team) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("MatchSetup", { teamId: team.id });
  }, [navigation, team]);

  const handleDeleteTeam = useCallback(() => {
    Alert.alert(
      "Delete Team",
      "Are you sure you want to delete this team? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTeamStorage(route.params.teamId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              navigation.goBack();
            } catch (error) {
              console.error("Error deleting team:", error);
            }
          },
        },
      ]
    );
  }, [navigation, route.params.teamId]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: team?.name || "Team",
      headerRight: () => (
        <View style={styles.headerButtons}>
          <HeaderButton onPress={handleEditSquad}>
            <Feather name="edit-2" size={20} color={AppColors.pitchGreen} />
          </HeaderButton>
          <HeaderButton onPress={handleDeleteTeam}>
            <Feather name="trash-2" size={20} color={AppColors.redCard} />
          </HeaderButton>
        </View>
      ),
    });
  }, [navigation, team, handleEditSquad, handleDeleteTeam]);

  const renderPlayerItem = useCallback(
    ({ item }: { item: Player }) => (
      <View style={styles.playerItem}>
        <View style={styles.playerNumber}>
          <ThemedText type="body" style={styles.numberText}>
            {item.squadNumber ?? "-"}
          </ThemedText>
        </View>
        <ThemedText type="body" style={styles.playerName}>
          {item.name}
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

  if (!team) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight },
        ]}
      >
        <View style={styles.loadingContainer}>
          <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
            Team not found
          </ThemedText>
        </View>
      </View>
    );
  }

  const hasPlayers = team.players.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: 100 + insets.bottom,
          },
        ]}
        data={[1]}
        keyExtractor={() => "content"}
        renderItem={() => (
          <View>
            <Card elevation={2} style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <ThemedText type="h3">{team.matchesPlayed}</ThemedText>
                  <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
                    Played
                  </ThemedText>
                </View>
                <View style={styles.statItem}>
                  <ThemedText type="h3" style={{ color: AppColors.pitchGreen }}>
                    {team.wins}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
                    Won
                  </ThemedText>
                </View>
                <View style={styles.statItem}>
                  <ThemedText type="h3" style={{ color: AppColors.warningYellow }}>
                    {team.draws}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
                    Drawn
                  </ThemedText>
                </View>
                <View style={styles.statItem}>
                  <ThemedText type="h3" style={{ color: AppColors.redCard }}>
                    {team.losses}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>
                    Lost
                  </ThemedText>
                </View>
              </View>
            </Card>

            <View style={styles.squadHeader}>
              <ThemedText type="h4">Squad</ThemedText>
              <Pressable
                onPress={handleEditSquad}
                style={({ pressed }) => [
                  styles.editButton,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="edit-2" size={16} color={AppColors.pitchGreen} />
                <ThemedText type="small" style={{ color: AppColors.pitchGreen }}>
                  Edit
                </ThemedText>
              </Pressable>
            </View>

            {hasPlayers ? (
              <Card elevation={2} style={styles.squadCard}>
                {team.players.map((player, index) => (
                  <View key={player.id}>
                    {renderPlayerItem({ item: player })}
                    {index < team.players.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </View>
                ))}
              </Card>
            ) : (
              <Card elevation={2} style={styles.emptySquadCard}>
                <Feather
                  name="users"
                  size={32}
                  color={AppColors.textSecondary}
                />
                <ThemedText
                  type="body"
                  style={{ color: AppColors.textSecondary, textAlign: "center" }}
                >
                  No players added yet
                </ThemedText>
                <Pressable
                  style={({ pressed }) => [
                    styles.addPlayersButton,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={handleEditSquad}
                >
                  <Feather name="plus" size={18} color="#FFFFFF" />
                  <ThemedText type="button" style={{ color: "#FFFFFF" }}>
                    Add Players
                  </ThemedText>
                </Pressable>
              </Card>
            )}
          </View>
        )}
      />

      <View
        style={[
          styles.fabContainer,
          { paddingBottom: insets.bottom + Spacing.lg },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            {
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
            !hasPlayers && styles.fabDisabled,
          ]}
          onPress={handleStartMatch}
          disabled={!hasPlayers}
        >
          <Feather name="play" size={24} color="#FFFFFF" />
          <ThemedText type="button" style={styles.fabText}>
            Start Match
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
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
  headerButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  squadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  squadCard: {
    padding: Spacing.md,
  },
  emptySquadCard: {
    padding: Spacing["2xl"],
    alignItems: "center",
    gap: Spacing.md,
  },
  addPlayersButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.pitchGreen,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  playerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  playerNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.elevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  numberText: {
    fontWeight: "600",
    fontSize: 14,
  },
  playerName: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.elevated,
  },
  fabContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "transparent",
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.pitchGreen,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabDisabled: {
    backgroundColor: AppColors.textDisabled,
  },
  fabText: {
    color: "#FFFFFF",
  },
});
