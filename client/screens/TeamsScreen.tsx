import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Image,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { HeaderButton } from "@react-navigation/elements";
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
    isPremium: false,
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

  const canAddTeam = subscription.isPremium || teams.length < subscription.maxTeams;

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

  React.useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      headerRight: () => (
        <HeaderButton
          onPress={handleAddTeam}
          disabled={!canAddTeam}
          pressOpacity={0.7}
        >
          <Feather
            name="plus"
            size={24}
            color={canAddTeam ? AppColors.pitchGreen : AppColors.textDisabled}
          />
        </HeaderButton>
      ),
    });
  }, [navigation, handleAddTeam, canAddTeam]);

  const renderTeamCard = useCallback(
    ({ item }: { item: Team }) => (
      <Card
        elevation={2}
        onPress={() => handleTeamPress(item)}
        style={styles.teamCard}
      >
        <View style={styles.teamCardContent}>
          <View style={styles.teamBadge}>
            <Feather name="shield" size={32} color={AppColors.pitchGreen} />
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
                type="caption"
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
        <Pressable
          style={({ pressed }) => [
            styles.createButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleAddTeam}
        >
          <Feather name="plus" size={20} color="#FFFFFF" />
          <ThemedText type="button" style={styles.createButtonText}>
            Create Team
          </ThemedText>
        </Pressable>
      </View>
    ),
    [handleAddTeam]
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
        teams.length === 0 && styles.emptyListContent,
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={teams}
      keyExtractor={(item) => item.id}
      renderItem={renderTeamCard}
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
    marginBottom: Spacing["2xl"],
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.pitchGreen,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  createButtonText: {
    color: "#FFFFFF",
  },
});
