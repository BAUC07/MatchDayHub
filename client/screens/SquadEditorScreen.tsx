import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
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
import { Team, Player, PlayerState } from "@/types";
import { getTeam, saveTeam, generateId } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SquadEditorRouteProp = RouteProp<RootStackParamList, "SquadEditor">;

const PLAYER_STATES: { key: PlayerState; label: string; color: string }[] = [
  { key: "starting", label: "Starting", color: AppColors.pitchGreen },
  { key: "substitute", label: "Substitute", color: AppColors.warningYellow },
  { key: "unavailable", label: "Unavailable", color: AppColors.textDisabled },
];

export default function SquadEditorScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SquadEditorRouteProp>();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTeam = useCallback(async () => {
    try {
      const teamData = await getTeam(route.params.teamId);
      if (teamData) {
        setTeam(teamData);
        setPlayers(teamData.players);
      }
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

  const handleSave = useCallback(async () => {
    if (!team || saving) return;

    setSaving(true);
    try {
      const updatedTeam = { ...team, players };
      await saveTeam(updatedTeam);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error("Error saving team:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [team, players, saving, navigation]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton onPress={handleSave} disabled={saving}>
          <ThemedText
            type="body"
            style={{
              color: !saving ? AppColors.pitchGreen : AppColors.textDisabled,
              fontWeight: "600",
            }}
          >
            {saving ? "Saving..." : "Done"}
          </ThemedText>
        </HeaderButton>
      ),
    });
  }, [navigation, handleSave, saving]);

  const handleAddPlayer = useCallback(() => {
    const name = newPlayerName.trim();
    if (!name) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const number = newPlayerNumber.trim()
      ? parseInt(newPlayerNumber.trim(), 10)
      : undefined;

    const newPlayer: Player = {
      id: generateId(),
      name,
      squadNumber: number,
      state: "starting",
    };

    setPlayers((prev) => [...prev, newPlayer]);
    setNewPlayerName("");
    setNewPlayerNumber("");
  }, [newPlayerName, newPlayerNumber]);

  const handleRemovePlayer = useCallback((playerId: string) => {
    Alert.alert("Remove Player", "Are you sure you want to remove this player?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setPlayers((prev) => prev.filter((p) => p.id !== playerId));
        },
      },
    ]);
  }, []);

  const handleChangeState = useCallback((playerId: string, newState: PlayerState) => {
    Haptics.selectionAsync();
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, state: newState } : p))
    );
  }, []);

  const renderPlayerItem = useCallback(
    ({ item }: { item: Player }) => (
      <Card elevation={2} style={styles.playerCard}>
        <View style={styles.playerHeader}>
          <View style={styles.playerInfo}>
            <View style={styles.playerNumber}>
              <ThemedText type="body" style={styles.numberText}>
                {item.squadNumber ?? "-"}
              </ThemedText>
            </View>
            <ThemedText type="body" numberOfLines={1} style={styles.playerName}>
              {item.name}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => handleRemovePlayer(item.id)}
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="x" size={20} color={AppColors.redCard} />
          </Pressable>
        </View>

        <View style={styles.stateButtons}>
          {PLAYER_STATES.map((state) => (
            <Pressable
              key={state.key}
              style={[
                styles.stateButton,
                item.state === state.key && {
                  backgroundColor: state.color,
                },
              ]}
              onPress={() => handleChangeState(item.id, state.key)}
            >
              <ThemedText
                type="caption"
                style={[
                  styles.stateButtonText,
                  item.state === state.key && { color: "#FFFFFF" },
                ]}
              >
                {state.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>
    ),
    [handleRemovePlayer, handleChangeState]
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
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={renderPlayerItem}
        ListHeaderComponent={
          <Card elevation={2} style={styles.addPlayerCard}>
            <ThemedText type="small" style={styles.addPlayerTitle}>
              ADD NEW PLAYER
            </ThemedText>
            <View style={styles.addPlayerInputs}>
              <TextInput
                style={[styles.nameInput, { color: theme.text }]}
                value={newPlayerName}
                onChangeText={setNewPlayerName}
                placeholder="Player name"
                placeholderTextColor={AppColors.textDisabled}
                returnKeyType="next"
              />
              <TextInput
                style={[styles.numberInput, { color: theme.text }]}
                value={newPlayerNumber}
                onChangeText={setNewPlayerNumber}
                placeholder="#"
                placeholderTextColor={AppColors.textDisabled}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.addButton,
                  { opacity: pressed ? 0.8 : 1 },
                  !newPlayerName.trim() && styles.addButtonDisabled,
                ]}
                onPress={handleAddPlayer}
                disabled={!newPlayerName.trim()}
              >
                <Feather name="plus" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </Card>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={32} color={AppColors.textSecondary} />
            <ThemedText
              type="body"
              style={{ color: AppColors.textSecondary, textAlign: "center" }}
            >
              Add players using the form above
            </ThemedText>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
  addPlayerCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  addPlayerTitle: {
    color: AppColors.textSecondary,
    marginBottom: Spacing.md,
  },
  addPlayerInputs: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  nameInput: {
    flex: 1,
    height: 44,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  numberInput: {
    width: 50,
    height: 44,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    fontSize: 16,
    textAlign: "center",
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: AppColors.pitchGreen,
    borderRadius: BorderRadius.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonDisabled: {
    backgroundColor: AppColors.textDisabled,
  },
  playerCard: {
    padding: Spacing.md,
  },
  playerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  playerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  playerNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  stateButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  stateButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    backgroundColor: AppColors.elevated,
    alignItems: "center",
  },
  stateButtonText: {
    color: AppColors.textSecondary,
  },
  separator: {
    height: Spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
});
