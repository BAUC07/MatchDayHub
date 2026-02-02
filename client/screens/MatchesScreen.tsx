import React, { useState, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Image,
  RefreshControl,
  Pressable,
  Modal,
  Animated,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Match, Team } from "@/types";
import { getMatches, getTeams, deleteMatch, saveMatch } from "@/lib/storage";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState("");
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const filteredMatches = selectedTeamFilter
    ? matches.filter((m) => m.teamId === selectedTeamFilter)
    : matches;

  const handleFilterPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilterPicker(true);
  }, []);

  const handleSelectFilter = useCallback((teamId: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTeamFilter(teamId);
    setShowFilterPicker(false);
  }, []);

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

  const handleToggleNotes = useCallback((match: Match) => {
    if (expandedNotesId === match.id) {
      setExpandedNotesId(null);
      setEditingNotesText("");
    } else {
      setExpandedNotesId(match.id);
      setEditingNotesText(match.notes || "");
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [expandedNotesId]);

  const handleNotesChange = useCallback((text: string, matchId: string) => {
    setEditingNotesText(text);
    
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }
    
    notesTimeoutRef.current = setTimeout(async () => {
      const matchToUpdate = matches.find(m => m.id === matchId);
      if (matchToUpdate) {
        const updatedMatch = { ...matchToUpdate, notes: text };
        await saveMatch(updatedMatch);
        setMatches(prev => prev.map(m => m.id === matchId ? updatedMatch : m));
      }
    }, 500);
  }, [matches]);

  const handleDeletePress = useCallback((match: Match) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMatchToDelete(match);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!matchToDelete) return;
    
    try {
      await deleteMatch(matchToDelete.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMatches((prev) => prev.filter((m) => m.id !== matchToDelete.id));
    } catch (error) {
      console.error("Error deleting match:", error);
    } finally {
      setShowDeleteConfirm(false);
      setMatchToDelete(null);
    }
  }, [matchToDelete]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setMatchToDelete(null);
    if (matchToDelete) {
      const swipeable = swipeableRefs.current.get(matchToDelete.id);
      swipeable?.close();
    }
  }, [matchToDelete]);

  const renderRightActions = useCallback(
    (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, match: Match) => {
      const translateX = dragX.interpolate({
        inputRange: [-80, 0],
        outputRange: [0, 80],
        extrapolate: "clamp",
      });

      return (
        <Animated.View style={[styles.deleteAction, { transform: [{ translateX }] }]}>
          <Pressable
            style={styles.deleteButton}
            onPress={() => handleDeletePress(match)}
          >
            <Feather name="trash-2" size={24} color="#FFFFFF" />
            <ThemedText type="small" style={styles.deleteText}>
              Delete
            </ThemedText>
          </Pressable>
        </Animated.View>
      );
    },
    [handleDeletePress]
  );

  const renderFilterButton = useCallback(() => {
    if (teams.length <= 1) return null;
    
    const filterLabel = selectedTeamFilter
      ? getTeamName(selectedTeamFilter)
      : "All Teams";

    return (
      <Pressable
        style={({ pressed }) => [
          styles.filterButton,
          { opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={handleFilterPress}
      >
        <Feather name="filter" size={16} color={AppColors.textSecondary} />
        <ThemedText type="body" style={{ color: theme.text, marginLeft: Spacing.sm }}>
          {filterLabel}
        </ThemedText>
        <Feather name="chevron-down" size={16} color={AppColors.textSecondary} style={{ marginLeft: Spacing.xs }} />
      </Pressable>
    );
  }, [teams.length, selectedTeamFilter, getTeamName, handleFilterPress, theme.text]);

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
        <Swipeable
          ref={(ref) => {
            if (ref) {
              swipeableRefs.current.set(item.id, ref);
            }
          }}
          renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}
          overshootRight={false}
          friction={2}
        >
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

            <Pressable 
              style={styles.notesToggle} 
              onPress={(e) => { e.stopPropagation(); handleToggleNotes(item); }}
              hitSlop={8}
            >
              <Feather 
                name={item.notes ? "file-text" : "edit-3"} 
                size={16} 
                color={item.notes ? AppColors.pitchGreen : AppColors.textSecondary} 
              />
            </Pressable>
          </Pressable>

          {expandedNotesId === item.id ? (
            <View style={styles.notesContainer}>
              <TextInput
                style={styles.notesInput}
                value={editingNotesText}
                onChangeText={(text) => handleNotesChange(text, item.id)}
                placeholder="Add match notes..."
                placeholderTextColor={AppColors.textSecondary}
                multiline
                textAlignVertical="top"
              />
              <ThemedText type="caption" style={styles.notesHint}>Notes are saved automatically</ThemedText>
            </View>
          ) : item.notes ? (
            <Pressable style={styles.notesPreview} onPress={() => handleToggleNotes(item)}>
              <ThemedText type="small" style={styles.notesPreviewText} numberOfLines={2}>
                {item.notes}
              </ThemedText>
            </Pressable>
          ) : null}
        </Swipeable>
      );
    },
    [getTeamName, handleMatchPress, renderRightActions, expandedNotesId, editingNotesText, handleToggleNotes, handleNotesChange]
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
        data={filteredMatches}
        keyExtractor={(item) => item.id}
        renderItem={renderMatchCard}
        ListHeaderComponent={
          <>
            {renderFilterButton()}
            {renderNewMatchCard()}
            {filteredMatches.length === 0 ? renderEmptyState() : null}
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
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <Pressable style={styles.deleteModalOverlay} onPress={handleCancelDelete}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalIcon}>
              <Feather name="trash-2" size={32} color={AppColors.redCard} />
            </View>
            <ThemedText type="h4" style={styles.deleteModalTitle}>
              Delete Match?
            </ThemedText>
            {matchToDelete ? (
              <ThemedText type="body" style={styles.deleteModalText}>
                {getTeamName(matchToDelete.teamId)} vs {matchToDelete.opposition}
                {"\n"}
                {matchToDelete.scoreFor} - {matchToDelete.scoreAgainst}
              </ThemedText>
            ) : null}
            <ThemedText type="small" style={styles.deleteModalWarning}>
              This action cannot be undone.
            </ThemedText>
            <View style={styles.deleteModalButtons}>
              <Pressable
                style={[styles.deleteModalButton, styles.cancelButton]}
                onPress={handleCancelDelete}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.deleteModalButton, styles.confirmDeleteButton]}
                onPress={handleConfirmDelete}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Delete
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

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

      <Modal
        visible={showFilterPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFilterPicker(false)}
        >
          <View />
        </Pressable>
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={styles.modalHandle} />
          <ThemedText type="h4" style={styles.modalTitle}>
            Filter by Team
          </ThemedText>
          <Pressable
            style={({ pressed }) => [
              styles.teamOption,
              { opacity: pressed ? 0.8 : 1 },
              !selectedTeamFilter && styles.filterOptionSelected,
            ]}
            onPress={() => handleSelectFilter(null)}
          >
            <View style={styles.teamOptionIcon}>
              <Feather name="users" size={24} color={AppColors.pitchGreen} />
            </View>
            <View style={styles.teamOptionInfo}>
              <ThemedText type="body">All Teams</ThemedText>
              <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                {matches.length} matches total
              </ThemedText>
            </View>
            {!selectedTeamFilter ? (
              <Feather name="check" size={20} color={AppColors.pitchGreen} />
            ) : null}
          </Pressable>
          <View style={styles.teamSeparator} />
          <FlatList
            data={teams}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const matchCount = matches.filter((m) => m.teamId === item.id).length;
              const isSelected = selectedTeamFilter === item.id;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.teamOption,
                    { opacity: pressed ? 0.8 : 1 },
                    isSelected && styles.filterOptionSelected,
                  ]}
                  onPress={() => handleSelectFilter(item.id)}
                >
                  <View style={styles.teamOptionIcon}>
                    <Feather name="shield" size={24} color={AppColors.pitchGreen} />
                  </View>
                  <View style={styles.teamOptionInfo}>
                    <ThemedText type="body">{item.name}</ThemedText>
                    <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                      {matchCount} matches
                    </ThemedText>
                  </View>
                  {isSelected ? (
                    <Feather name="check" size={20} color={AppColors.pitchGreen} />
                  ) : null}
                </Pressable>
              );
            }}
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
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  filterOptionSelected: {
    backgroundColor: "rgba(0, 168, 107, 0.1)",
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
  deleteAction: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    width: 80,
    height: "100%",
    backgroundColor: AppColors.redCard,
    justifyContent: "center",
    alignItems: "center",
    borderTopRightRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
  deleteText: {
    color: "#FFFFFF",
    marginTop: 4,
    fontWeight: "600",
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  deleteModalContent: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  deleteModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(220, 20, 60, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  deleteModalTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  deleteModalText: {
    textAlign: "center",
    color: AppColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  deleteModalWarning: {
    textAlign: "center",
    color: AppColors.redCard,
    marginBottom: Spacing.xl,
  },
  deleteModalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  deleteModalButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: AppColors.elevated,
  },
  confirmDeleteButton: {
    backgroundColor: AppColors.redCard,
  },
  notesToggle: {
    position: "absolute",
    right: Spacing.md,
    top: Spacing.md,
    padding: Spacing.xs,
  },
  notesContainer: {
    backgroundColor: AppColors.elevated,
    padding: Spacing.md,
    marginTop: 2,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
  },
  notesInput: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    color: AppColors.textPrimary,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  notesHint: {
    color: AppColors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  notesPreview: {
    backgroundColor: AppColors.elevated,
    padding: Spacing.sm,
    marginTop: 2,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
  },
  notesPreviewText: {
    color: AppColors.textSecondary,
    fontStyle: "italic",
  },
});
