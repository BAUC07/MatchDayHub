import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  Modal,
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
import { Team } from "@/types";
import { getTeams, deleteTeamAndMatches, archiveTeams } from "@/lib/storage";
import { useRevenueCat } from "@/lib/revenuecat";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TeamsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { isElite } = useRevenueCat();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [showActionModal, setShowActionModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<"delete" | "archive" | null>(null);

  const loadData = useCallback(async () => {
    try {
      const teamsData = await getTeams();
      const activeTeams = teamsData.filter((t) => !t.isArchived);
      setTeams(activeTeams);
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
      setIsManageMode(false);
      setSelectedTeamIds(new Set());
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const activeTeamCount = teams.filter((t) => !t.isArchived).length;
  const canAddTeam = isElite || activeTeamCount < 1;

  const handleAddTeam = useCallback(() => {
    if (canAddTeam) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("CreateTeam");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      navigation.navigate("Paywall");
    }
  }, [canAddTeam, navigation]);

  const handleTeamPress = useCallback(
    (team: Team) => {
      if (isManageMode) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedTeamIds((prev) => {
          const next = new Set(prev);
          if (next.has(team.id)) {
            next.delete(team.id);
          } else {
            next.add(team.id);
          }
          return next;
        });
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate("TeamDetail", { teamId: team.id });
      }
    },
    [isManageMode, navigation]
  );

  const handleManagePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isManageMode) {
      setIsManageMode(false);
      setSelectedTeamIds(new Set());
    } else {
      setIsManageMode(true);
    }
  }, [isManageMode]);

  const handleActionPress = useCallback(() => {
    if (selectedTeamIds.size === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowActionModal(true);
  }, [selectedTeamIds.size]);

  const handleDelete = useCallback(() => {
    setShowActionModal(false);
    setShowConfirmModal("delete");
  }, []);

  const handleArchive = useCallback(() => {
    setShowActionModal(false);
    setShowConfirmModal("archive");
  }, []);

  const confirmDelete = useCallback(async () => {
    try {
      for (const teamId of selectedTeamIds) {
        await deleteTeamAndMatches(teamId);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedTeamIds(new Set());
      setIsManageMode(false);
      setShowConfirmModal(null);
      loadData();
    } catch (error) {
      console.error("Error deleting teams:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [selectedTeamIds, loadData]);

  const confirmArchive = useCallback(async () => {
    try {
      await archiveTeams(Array.from(selectedTeamIds));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedTeamIds(new Set());
      setIsManageMode(false);
      setShowConfirmModal(null);
      loadData();
    } catch (error) {
      console.error("Error archiving teams:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [selectedTeamIds, loadData]);

  const renderTeamCard = useCallback(
    ({ item }: { item: Team }) => {
      const isSelected = selectedTeamIds.has(item.id);
      return (
        <Card
          elevation={2}
          onPress={() => handleTeamPress(item)}
          style={isSelected ? [styles.teamCard, styles.teamCardSelected] : styles.teamCard}
        >
          <View style={styles.teamCardContent}>
            {isManageMode ? (
              <View style={styles.checkbox}>
                {isSelected ? (
                  <View style={styles.checkboxChecked}>
                    <Feather name="check" size={16} color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.checkboxUnchecked} />
                )}
              </View>
            ) : null}
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
            {!isManageMode ? (
              <Feather name="chevron-right" size={24} color={AppColors.textSecondary} />
            ) : null}
          </View>
        </Card>
      );
    },
    [handleTeamPress, isManageMode, selectedTeamIds]
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

  const renderManageButton = useCallback(
    () => (
      <Pressable
        style={({ pressed }) => [
          styles.manageButton,
          { opacity: pressed ? 0.8 : 1 },
          isManageMode && styles.manageButtonActive,
        ]}
        onPress={handleManagePress}
      >
        <Feather
          name={isManageMode ? "x" : "settings"}
          size={20}
          color={isManageMode ? "#FFFFFF" : AppColors.textSecondary}
        />
        <ThemedText
          type="body"
          style={{
            color: isManageMode ? "#FFFFFF" : AppColors.textSecondary,
            marginLeft: Spacing.sm,
          }}
        >
          {isManageMode ? "Cancel" : "Manage Teams"}
        </ThemedText>
      </Pressable>
    ),
    [isManageMode, handleManagePress]
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

  const renderListHeader = useCallback(() => {
    if (teams.length === 0) {
      return renderEmptyState();
    }
    return renderManageButton();
  }, [teams.length, renderEmptyState, renderManageButton]);

  const renderListFooter = useCallback(() => {
    if (isManageMode) {
      return null;
    }
    return (
      <View style={styles.footerContainer}>
        {renderCreateTeamCard()}
      </View>
    );
  }, [isManageMode, renderCreateTeamCard]);

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
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: isManageMode ? tabBarHeight + 100 : tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={teams}
        keyExtractor={(item) => item.id}
        renderItem={renderTeamCard}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={AppColors.pitchGreen}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {isManageMode && selectedTeamIds.size > 0 ? (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + tabBarHeight + Spacing.md }]}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionButtonAction,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleActionPress}
          >
            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Actions ({selectedTeamIds.size})
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={showActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowActionModal(false)}
        >
          <View style={styles.modalContent}>
            <ThemedText type="h4" style={styles.modalTitle}>
              What would you like to do with {selectedTeamIds.size} team{selectedTeamIds.size > 1 ? "s" : ""}?
            </ThemedText>

            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalButtonArchive,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleArchive}
            >
              <Feather name="archive" size={20} color={AppColors.warningYellow} />
              <View style={styles.modalButtonText}>
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Archive
                </ThemedText>
                <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                  Hide from list, keep data for Stats
                </ThemedText>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalButtonDelete,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleDelete}
            >
              <Feather name="trash-2" size={20} color={AppColors.redCard} />
              <View style={styles.modalButtonText}>
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Delete
                </ThemedText>
                <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                  Permanently remove team and all data
                </ThemedText>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                styles.modalButtonCancel,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => setShowActionModal(false)}
            >
              <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
                Cancel
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showConfirmModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(null)}
      >
        <Pressable
          style={styles.confirmModalOverlay}
          onPress={() => setShowConfirmModal(null)}
        >
          <View style={styles.confirmModalContent}>
            <View style={showConfirmModal === "delete" ? styles.deleteIcon : styles.archiveIcon}>
              <Feather
                name={showConfirmModal === "delete" ? "trash-2" : "archive"}
                size={32}
                color={showConfirmModal === "delete" ? AppColors.redCard : AppColors.warningYellow}
              />
            </View>
            <ThemedText type="h4" style={styles.modalTitle}>
              {showConfirmModal === "delete" ? "Delete Teams" : "Archive Teams"}
            </ThemedText>
            
            <View style={styles.teamNamesList}>
              {Array.from(selectedTeamIds).map((teamId) => {
                const team = teams.find((t) => t.id === teamId);
                return team ? (
                  <View key={teamId} style={styles.teamNameItem}>
                    <Feather name="shield" size={16} color={AppColors.pitchGreen} />
                    <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                      {team.name}
                    </ThemedText>
                  </View>
                ) : null;
              })}
            </View>

            {showConfirmModal === "delete" ? (
              <ThemedText type="body" style={styles.warningText}>
                All match data for {selectedTeamIds.size === 1 ? "this team" : "these teams"} will be permanently deleted. This cannot be undone.
              </ThemedText>
            ) : (
              <ThemedText type="body" style={{ color: AppColors.textSecondary, textAlign: "center", marginBottom: Spacing.xl }}>
                {selectedTeamIds.size === 1 ? "This team" : "These teams"} will be hidden from this list but match data will remain viewable in Stats.
              </ThemedText>
            )}

            <View style={styles.confirmButtonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  styles.confirmButtonCancel,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => setShowConfirmModal(null)}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  showConfirmModal === "delete" ? styles.confirmButtonDelete : styles.confirmButtonArchive,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={showConfirmModal === "delete" ? confirmDelete : confirmArchive}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  {showConfirmModal === "delete" ? "Delete" : "Archive"}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
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
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  manageButtonActive: {
    backgroundColor: AppColors.elevated,
  },
  createTeamCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.lg,
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
  footerContainer: {
    marginTop: Spacing.xl,
  },
  teamCard: {
    padding: Spacing.lg,
  },
  teamCardSelected: {
    borderWidth: 2,
    borderColor: AppColors.pitchGreen,
  },
  teamCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    marginRight: Spacing.md,
  },
  checkboxUnchecked: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: AppColors.textSecondary,
  },
  checkboxChecked: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.sm,
    backgroundColor: AppColors.pitchGreen,
    justifyContent: "center",
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
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: AppColors.surface,
    borderTopWidth: 1,
    borderTopColor: AppColors.elevated,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  actionButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  actionButtonAction: {
    backgroundColor: AppColors.pitchGreen,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
  },
  confirmModalContent: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  deleteIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(220, 20, 60, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  archiveIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  teamNamesList: {
    width: "100%",
    marginBottom: Spacing.lg,
  },
  teamNameItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  warningText: {
    color: AppColors.redCard,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  modalButtonArchive: {
    backgroundColor: AppColors.elevated,
  },
  modalButtonDelete: {
    backgroundColor: AppColors.elevated,
  },
  modalButtonCancel: {
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  modalButtonText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  confirmButtonRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  confirmButtonCancel: {
    backgroundColor: AppColors.elevated,
  },
  confirmButtonDelete: {
    backgroundColor: AppColors.redCard,
  },
  confirmButtonArchive: {
    backgroundColor: AppColors.warningYellow,
  },
});
