import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Image as RNImage,
  Pressable,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
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
import { Team, SubscriptionState } from "@/types";
import { getTeams, getSubscription } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TeamsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [teams, setTeams] = useState<Team[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    isElite: false,
    maxTeams: 1,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [teamsData, subData] = await Promise.all([
        getTeams(),
        getSubscription(),
      ]);
      setTeams(teamsData);
      setSubscription(subData);
    } catch (error) {
      console.error("Error loading teams:", error);
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

  const canAddTeam = subscription.isElite || teams.length < subscription.maxTeams;

  const handleAddTeam = useCallback(() => {
    if (canAddTeam) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("CreateTeam");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [canAddTeam, navigation]);

  const handleTeamPress = useCallback(
    (team: Team) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("TeamDetail", { teamId: team.id });
    },
    [navigation]
  );

  const renderTeamCard = useCallback(
    ({ item }: { item: Team }) => (
      <Card
        elevation={2}
        onPress={() => handleTeamPress(item)}
        style={styles.teamCard}
      >
        <View style={styles.teamCardContent}>
          <View style={styles.teamBadge}>
            {item.logoUri ? (
              <Image source={{ uri: item.logoUri }} style={styles.teamLogoImage} />
            ) : (
              <Feather name="shield" size={32} color={AppColors.pitchGreen} />
            )}
          </View>
          <View style={styles.teamInfo}>
            <ThemedText type="h4" style={styles.teamName}>
              {item.name}
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: AppColors.textSecondary }}
            >
              {item.players.length} players
            </ThemedText>
            {item.matchesPlayed > 0 ? (
              <ThemedText
                type="small"
                style={{ color: AppColors.textSecondary, marginTop: 4 }}
              >
                W{item.wins} D{item.draws} L{item.losses}
              </ThemedText>
            ) : null}
          </View>
          <Feather name="chevron-right" size={24} color={AppColors.textSecondary} />
        </View>
      </Card>
    ),
    [handleTeamPress]
  );

  const renderCreateTeamCard = useCallback(
    () => (
      <Pressable
        style={({ pressed }) => [
          styles.createTeamCard,
          { opacity: pressed ? 0.8 : 1 },
          !canAddTeam && styles.createTeamCardDisabled,
        ]}
        onPress={handleAddTeam}
        disabled={!canAddTeam}
      >
        <View style={styles.createTeamIcon}>
          <Feather
            name="plus"
            size={28}
            color={canAddTeam ? AppColors.pitchGreen : AppColors.textDisabled}
          />
        </View>
        <View style={styles.createTeamText}>
          <ThemedText
            type="h4"
            style={{
              color: canAddTeam ? theme.text : AppColors.textDisabled,
            }}
          >
            Create Team
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: AppColors.textSecondary }}
          >
            {canAddTeam
              ? "Add a new team to manage"
              : "Upgrade to add more teams"}
          </ThemedText>
        </View>
      </Pressable>
    ),
    [canAddTeam, handleAddTeam, theme.text]
  );

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Image
          source={require("../../assets/images/empty-teams.png")}
          style={styles.emptyImage}
          resizeMode="contain"
        />
        <ThemedText type="h3" style={styles.emptyTitle}>
          No Teams Yet
        </ThemedText>
        <ThemedText type="body" style={styles.emptyText}>
          Create your first team to start logging matches
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
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={teams}
      keyExtractor={(item) => item.id}
      renderItem={renderTeamCard}
      ListHeaderComponent={
        <>
          {renderCreateTeamCard()}
          {teams.length === 0 ? renderEmptyState() : null}
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
  createTeamCard: {
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
  createTeamCardDisabled: {
    borderColor: AppColors.textDisabled,
  },
  createTeamIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.elevated,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.lg,
  },
  createTeamText: {
    flex: 1,
  },
  teamCard: {
    padding: Spacing.lg,
  },
  teamCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  teamBadge: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.surface,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.lg,
    overflow: "hidden",
  },
  teamLogoImage: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    marginBottom: 2,
  },
  separator: {
    height: Spacing.md,
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
});
