import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { HeaderButton } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Team, Player } from "@/types";
import { getTeam, saveTeam, generateId } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SquadEditorRouteProp = RouteProp<RootStackParamList, "SquadEditor">;

export default function SquadEditorScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SquadEditorRouteProp>();

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingNumber, setEditingNumber] = useState("");

  const loadTeam = useCallback(async () => {
    try {
      const teamData = await getTeam(route.params.teamId);
      if (teamData) {
        setTeam(teamData);
        setPlayers(teamData.players);
        setLogoUri(teamData.logoUri || null);
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

  const handlePickLogo = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!team || saving) return;

    setSaving(true);
    try {
      const updatedTeam = { ...team, players, logoUri: logoUri || undefined };
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
      state: "substitute",
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

  const handleStartEdit = useCallback((player: Player) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingPlayerId(player.id);
    setEditingName(player.name);
    setEditingNumber(player.squadNumber?.toString() || "");
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingPlayerId || !editingName.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const number = editingNumber.trim()
      ? parseInt(editingNumber.trim(), 10)
      : undefined;

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === editingPlayerId
          ? { ...p, name: editingName.trim(), squadNumber: number }
          : p
      )
    );
    setEditingPlayerId(null);
    setEditingName("");
    setEditingNumber("");
  }, [editingPlayerId, editingName, editingNumber]);

  const handleCancelEdit = useCallback(() => {
    setEditingPlayerId(null);
    setEditingName("");
    setEditingNumber("");
  }, []);

  const renderPlayerItem = useCallback(
    ({ item }: { item: Player }) => {
      const isEditing = editingPlayerId === item.id;

      if (isEditing) {
        return (
          <View style={styles.playerCardEditing}>
            <View style={styles.editInputsRow}>
              <TextInput
                style={[styles.editNumberInput, { color: theme.text }]}
                value={editingNumber}
                onChangeText={setEditingNumber}
                placeholder="#"
                placeholderTextColor={AppColors.textDisabled}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                style={[styles.editNameInput, { color: theme.text }]}
                value={editingName}
                onChangeText={setEditingName}
                placeholder="Player name"
                placeholderTextColor={AppColors.textDisabled}
                autoFocus
              />
            </View>
            <View style={styles.editActionsRow}>
              <Pressable
                style={styles.cancelEditButton}
                onPress={handleCancelEdit}
              >
                <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.saveEditButton,
                  !editingName.trim() && styles.saveEditButtonDisabled,
                ]}
                onPress={handleSaveEdit}
                disabled={!editingName.trim()}
              >
                <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Save
                </ThemedText>
              </Pressable>
            </View>
          </View>
        );
      }

      return (
        <Pressable
          style={({ pressed }) => [
            styles.playerCard,
            { opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => handleStartEdit(item)}
        >
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
          <View style={styles.playerActions}>
            <Feather name="edit-2" size={16} color={AppColors.textSecondary} />
            <Pressable
              onPress={() => handleRemovePlayer(item.id)}
              hitSlop={8}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Feather name="x" size={20} color={AppColors.redCard} />
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [handleRemovePlayer, handleStartEdit, handleSaveEdit, handleCancelEdit, editingPlayerId, editingName, editingNumber, theme.text]
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
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        data={players}
        keyExtractor={(item) => item.id}
        renderItem={renderPlayerItem}
        ListHeaderComponent={
          <>
            <Pressable
              style={styles.logoPickerContainer}
              onPress={handlePickLogo}
            >
              <View style={styles.logoPickerIcon}>
                {logoUri ? (
                  <Image source={{ uri: logoUri }} style={styles.logoImage} />
                ) : (
                  <Feather name="shield" size={40} color={AppColors.pitchGreen} />
                )}
              </View>
              <View style={styles.logoEditBadge}>
                <Feather name="camera" size={12} color="#FFFFFF" />
              </View>
              <ThemedText type="small" style={styles.logoHint}>
                {logoUri ? "Change club logo" : "Add club logo"}
              </ThemedText>
            </Pressable>

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
            <ThemedText type="small" style={styles.hint}>
                You'll select starting lineup when setting up a match
              </ThemedText>
            </Card>
          </>
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
  logoPickerContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoPickerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.surface,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  logoEditBadge: {
    position: "absolute",
    top: 56,
    right: "38%",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: AppColors.pitchGreen,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: AppColors.darkBg,
  },
  logoHint: {
    color: AppColors.textSecondary,
    marginTop: Spacing.sm,
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
    marginBottom: Spacing.md,
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
  hint: {
    color: AppColors.textSecondary,
    fontStyle: "italic",
  },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  playerCardEditing: {
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: AppColors.pitchGreen,
  },
  editInputsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  editNumberInput: {
    width: 50,
    height: 40,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    fontSize: 16,
    textAlign: "center",
  },
  editNameInput: {
    flex: 1,
    height: 40,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  editActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  cancelEditButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  saveEditButton: {
    backgroundColor: AppColors.pitchGreen,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xs,
  },
  saveEditButtonDisabled: {
    backgroundColor: AppColors.textDisabled,
  },
  playerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  playerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
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
  separator: {
    height: Spacing.xs,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
});
