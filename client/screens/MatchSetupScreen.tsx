import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  LayoutRectangle,
  Modal,
  FlatList,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { HeaderButton } from "@react-navigation/elements";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Team, Player, Match, MatchFormat, MatchLocation } from "@/types";
import { getTeam, saveTeam, saveMatch, generateId, getOppositionNames, addOppositionName } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MatchSetupRouteProp = RouteProp<RootStackParamList, "MatchSetup">;

type PlayerStatus = "starting" | "bench" | "unavailable";

const FORMATS: MatchFormat[] = ["5v5", "7v7", "9v9", "11v11"];
const LOCATIONS: { key: MatchLocation; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "away", label: "Away" },
];

interface ColumnLayouts {
  starting: LayoutRectangle | null;
  bench: LayoutRectangle | null;
  unavailable: LayoutRectangle | null;
}

interface DraggablePlayerProps {
  player: Player;
  status: PlayerStatus;
  onDrop: (playerId: string, targetStatus: PlayerStatus) => void;
  onTap: (playerId: string) => void;
  onLongPress: (playerId: string) => void;
  columnLayouts: React.MutableRefObject<ColumnLayouts>;
}

function DraggablePlayer({ player, status, onDrop, onTap, onLongPress, columnLayouts }: DraggablePlayerProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleDrop = (playerId: string, x: number, y: number, absoluteY: number) => {
    const startingLayout = columnLayouts.current.starting;
    const benchLayout = columnLayouts.current.bench;
    const unavailableLayout = columnLayouts.current.unavailable;
    
    if (startingLayout && x < startingLayout.width + 20) {
      onDrop(playerId, "starting");
    } else if (unavailableLayout && absoluteY > unavailableLayout.y) {
      onDrop(playerId, "unavailable");
    } else if (benchLayout) {
      onDrop(playerId, "bench");
    }
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      scale.value = withSpring(1.05);
      zIndex.value = 100;
      runOnJS(triggerHaptic)();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      isDragging.value = false;
      scale.value = withSpring(1);
      zIndex.value = 0;
      
      runOnJS(handleDrop)(player.id, event.absoluteX, event.translationY, event.absoluteY);
      
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onTap)(player.id);
  });

  const longPress = Gesture.LongPress()
    .minDuration(500)
    .onEnd(() => {
      runOnJS(onLongPress)(player.id);
    });

  const composed = Gesture.Race(gesture, Gesture.Exclusive(longPress, tap));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
    opacity: isDragging.value ? 0.9 : 1,
  }));

  let bgColor = AppColors.pitchGreen;
  let textColor = "#FFFFFF";
  
  if (status === "bench") {
    bgColor = "#2196F3";
  } else if (status === "unavailable") {
    bgColor = AppColors.elevated;
    textColor = AppColors.textDisabled;
  }

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          styles.playerCard,
          { backgroundColor: bgColor },
          animatedStyle,
        ]}
      >
        <View style={styles.dragHandle}>
          <Feather name="menu" size={14} color="rgba(255,255,255,0.5)" />
        </View>
        <View style={styles.playerAvatar}>
          <Feather name="user" size={14} color={AppColors.textSecondary} />
        </View>
        <ThemedText
          type="body"
          numberOfLines={1}
          style={[styles.playerName, { color: textColor }]}
        >
          {player.squadNumber ? `${player.squadNumber}. ` : ""}{player.name}
        </ThemedText>
      </Animated.View>
    </GestureDetector>
  );
}

export default function MatchSetupScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MatchSetupRouteProp>();

  const [team, setTeam] = useState<Team | null>(null);
  const [opposition, setOpposition] = useState("");
  const [location, setLocation] = useState<MatchLocation>("home");
  const [format, setFormat] = useState<MatchFormat>("11v11");
  const [gameDuration, setGameDuration] = useState("90");
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, PlayerStatus>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerNumber, setNewPlayerNumber] = useState("");
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [oppositionSuggestions, setOppositionSuggestions] = useState<string[]>([]);
  const [allOppositionNames, setAllOppositionNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const scrollViewRef = useRef<{ scrollToPosition?: (x: number, y: number, animated?: boolean) => void }>(null);

  const columnLayouts = useRef<ColumnLayouts>({
    starting: null,
    bench: null,
    unavailable: null,
  });

  const getDefaultDuration = (f: MatchFormat) => {
    switch (f) {
      case "5v5": return "40";
      case "7v7": return "50";
      case "9v9": return "60";
      case "11v11": return "90";
    }
  };

  const loadTeam = useCallback(async () => {
    try {
      const [teamData, savedOppositionNames] = await Promise.all([
        getTeam(route.params.teamId),
        getOppositionNames(),
      ]);
      setAllOppositionNames(savedOppositionNames);
      
      if (teamData) {
        setTeam(teamData);
        const initialStatuses: Record<string, PlayerStatus> = {};
        const maxStarting = getMaxPlayers(format);
        teamData.players.forEach((p, index) => {
          if (index < maxStarting) {
            initialStatuses[p.id] = "starting";
          } else {
            initialStatuses[p.id] = "bench";
          }
        });
        setPlayerStatuses(initialStatuses);
      }
    } catch (error) {
      console.error("Error loading team:", error);
    } finally {
      setLoading(false);
    }
  }, [route.params.teamId, format]);

  useFocusEffect(
    useCallback(() => {
      loadTeam();
    }, [loadTeam])
  );

  const handleAddPlayer = useCallback(async () => {
    if (!team || !newPlayerName.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const number = newPlayerNumber.trim()
      ? parseInt(newPlayerNumber.trim(), 10)
      : undefined;

    const newPlayer: Player = {
      id: generateId(),
      name: newPlayerName.trim(),
      squadNumber: number,
      state: "substitute",
    };

    const updatedPlayers = [...team.players, newPlayer];
    const updatedTeam = { ...team, players: updatedPlayers };
    
    setTeam(updatedTeam);
    setPlayerStatuses((prev) => ({ ...prev, [newPlayer.id]: "bench" }));
    setNewPlayerName("");
    setNewPlayerNumber("");
    setShowAddPlayerModal(false);
    
    await saveTeam(updatedTeam);
  }, [team, newPlayerName, newPlayerNumber]);

  const handleOppositionChange = useCallback((text: string) => {
    setOpposition(text);
    if (text.trim().length > 0) {
      const filtered = allOppositionNames.filter(
        (name) => name.toLowerCase().includes(text.toLowerCase()) && name.toLowerCase() !== text.toLowerCase()
      );
      setOppositionSuggestions(filtered.slice(0, 5));
      setShowSuggestions(filtered.length > 0);
    } else {
      setOppositionSuggestions([]);
      setShowSuggestions(false);
    }
  }, [allOppositionNames]);

  const handleSelectSuggestion = useCallback((name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpposition(name);
    setShowSuggestions(false);
    setOppositionSuggestions([]);
  }, []);

  const handleFormatChange = useCallback((f: MatchFormat) => {
    Haptics.selectionAsync();
    setFormat(f);
    setGameDuration(getDefaultDuration(f));
    setPlayerStatuses((prev) => {
      const max = getMaxPlayers(f);
      const starting = Object.entries(prev)
        .filter(([, s]) => s === "starting")
        .map(([id]) => id);
      if (starting.length > max) {
        const updated = { ...prev };
        starting.slice(max).forEach((id) => {
          updated[id] = "bench";
        });
        return updated;
      }
      return prev;
    });
  }, []);

  const allPlayers = team?.players || [];
  const startingPlayers = allPlayers.filter((p) => playerStatuses[p.id] === "starting");
  const benchPlayers = allPlayers.filter((p) => playerStatuses[p.id] === "bench");
  const unavailablePlayers = allPlayers.filter((p) => playerStatuses[p.id] === "unavailable");

  const getMaxPlayers = (f: MatchFormat) => {
    switch (f) {
      case "5v5": return 5;
      case "7v7": return 7;
      case "9v9": return 9;
      case "11v11": return 11;
    }
  };

  const maxPlayers = getMaxPlayers(format);
  const isValid = opposition.trim().length >= 1 && startingPlayers.length > 0;

  const handleDrop = useCallback((playerId: string, targetStatus: PlayerStatus) => {
    setPlayerStatuses((prev) => {
      const current = prev[playerId];
      if (current === targetStatus) return prev;
      
      if (targetStatus === "starting") {
        const currentStarting = Object.values(prev).filter((s) => s === "starting").length;
        if (currentStarting >= maxPlayers) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return prev;
        }
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { ...prev, [playerId]: targetStatus };
    });
  }, [maxPlayers]);

  const handleLongPress = useCallback((playerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlayerStatuses((prev) => {
      const current = prev[playerId] || "bench";
      if (current === "unavailable") {
        return { ...prev, [playerId]: "bench" };
      } else {
        return { ...prev, [playerId]: "unavailable" };
      }
    });
  }, []);

  const handleTap = useCallback((playerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayerStatuses((prev) => {
      const current = prev[playerId] || "bench";
      let next: PlayerStatus;
      
      if (current === "bench") {
        const currentStarting = Object.values(prev).filter((s) => s === "starting").length;
        if (currentStarting < maxPlayers) {
          next = "starting";
        } else {
          next = "unavailable";
        }
      } else if (current === "starting") {
        next = "bench";
      } else {
        next = "bench";
      }
      
      return { ...prev, [playerId]: next };
    });
  }, [maxPlayers]);

  const handleStartMatch = useCallback(async () => {
    if (!team || !isValid || creating) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCreating(true);

    try {
      const match: Match = {
        id: generateId(),
        teamId: team.id,
        opposition: opposition.trim(),
        location,
        format,
        date: new Date().toISOString(),
        startingLineup: startingPlayers.map((p) => p.id),
        substitutes: benchPlayers.map((p) => p.id),
        unavailablePlayers: unavailablePlayers.map((p) => p.id),
        events: [],
        scoreFor: 0,
        scoreAgainst: 0,
        isCompleted: false,
        totalMatchTime: 0,
        addedTime: 0,
        plannedDuration: parseInt(gameDuration, 10) || 60,
      };

      await saveMatch(match);
      await addOppositionName(opposition.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace("LiveMatch", { matchId: match.id });
    } catch (error) {
      console.error("Error creating match:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCreating(false);
    }
  }, [
    team,
    isValid,
    creating,
    opposition,
    location,
    format,
    gameDuration,
    startingPlayers,
    benchPlayers,
    navigation,
  ]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderButton onPress={handleStartMatch} disabled={!isValid || creating}>
          <ThemedText
            type="body"
            style={{
              color: isValid && !creating ? AppColors.pitchGreen : AppColors.textDisabled,
              fontWeight: "600",
            }}
          >
            {creating ? "Starting..." : "Start"}
          </ThemedText>
        </HeaderButton>
      ),
    });
  }, [navigation, handleStartMatch, isValid, creating]);

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
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Card elevation={2} style={styles.matchInfoCard}>
        <View style={styles.inputRow}>
          <ThemedText type="small" style={styles.inputLabel}>VS</ThemedText>
          <View style={styles.oppositionContainer}>
            <TextInput
              style={[styles.oppositionInput, { color: theme.text }]}
              value={opposition}
              onChangeText={handleOppositionChange}
              onFocus={() => {
                if (oppositionSuggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              placeholder="Opposition team"
              placeholderTextColor={AppColors.textDisabled}
              maxLength={50}
            />
            {showSuggestions && oppositionSuggestions.length > 0 ? (
              <View style={styles.suggestionsDropdown}>
                {oppositionSuggestions.map((name) => (
                  <Pressable
                    key={name}
                    style={({ pressed }) => [
                      styles.suggestionItem,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={() => handleSelectSuggestion(name)}
                  >
                    <Feather name="clock" size={14} color={AppColors.textSecondary} />
                    <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                      {name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.optionsRow}>
          <View style={styles.locationButtons}>
            {LOCATIONS.map((loc) => (
              <Pressable
                key={loc.key}
                style={[
                  styles.optionButton,
                  location === loc.key && styles.optionButtonActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setLocation(loc.key);
                }}
              >
                <ThemedText
                  type="small"
                  style={[
                    styles.optionText,
                    location === loc.key && styles.optionTextActive,
                  ]}
                >
                  {loc.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.formatButtons}>
            {FORMATS.map((f) => (
              <Pressable
                key={f}
                style={[
                  styles.formatButton,
                  format === f && styles.formatButtonActive,
                ]}
                onPress={() => handleFormatChange(f)}
              >
                <ThemedText
                  type="caption"
                  style={[
                    styles.formatText,
                    format === f && styles.formatTextActive,
                  ]}
                >
                  {f}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.durationRow}>
          <Feather name="clock" size={16} color={AppColors.textSecondary} />
          <ThemedText type="small" style={styles.durationLabel}>
            Game Time
          </ThemedText>
          <TextInput
            style={[styles.durationInput, { color: theme.text }]}
            value={gameDuration}
            onChangeText={(text) => setGameDuration(text.replace(/[^0-9]/g, ""))}
            placeholder="60"
            placeholderTextColor={AppColors.textDisabled}
            keyboardType="number-pad"
            maxLength={3}
          />
          <ThemedText type="small" style={styles.durationUnit}>
            mins
          </ThemedText>
        </View>
      </Card>

      <ThemedText type="caption" style={styles.hint}>
        Drag players between columns or tap to move
      </ThemedText>

      {allPlayers.length > 0 ? (
        <View style={styles.columnsContainer}>
          <View
            style={styles.column}
            onLayout={(e) => {
              columnLayouts.current.starting = e.nativeEvent.layout;
            }}
          >
            <View style={styles.columnHeader}>
              <Feather name="play" size={18} color={AppColors.pitchGreen} />
              <ThemedText type="h4" style={{ color: AppColors.pitchGreen }}>
                Starting
              </ThemedText>
              <ThemedText type="caption" style={styles.countBadge}>
                {startingPlayers.length}/{maxPlayers}
              </ThemedText>
            </View>
            <View style={styles.playersList}>
              {startingPlayers.map((p) => (
                <DraggablePlayer
                  key={p.id}
                  player={p}
                  status="starting"
                  onDrop={handleDrop}
                  onTap={handleTap}
                  onLongPress={handleLongPress}
                  columnLayouts={columnLayouts}
                />
              ))}
              {startingPlayers.length === 0 ? (
                <View style={styles.emptyColumn}>
                  <Feather name="arrow-left" size={20} color={AppColors.textDisabled} />
                  <ThemedText type="small" style={{ color: AppColors.textDisabled, textAlign: "center" }}>
                    Drag or tap players here
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={styles.column}
            onLayout={(e) => {
              columnLayouts.current.bench = e.nativeEvent.layout;
            }}
          >
            <View style={styles.columnHeader}>
              <Feather name="users" size={18} color="#2196F3" />
              <ThemedText type="h4" style={{ color: "#2196F3" }}>
                On Bench
              </ThemedText>
              <ThemedText type="caption" style={styles.countBadge}>
                {benchPlayers.length}
              </ThemedText>
            </View>
            <View style={styles.playersList}>
              {benchPlayers.map((p) => (
                <DraggablePlayer
                  key={p.id}
                  player={p}
                  status="bench"
                  onDrop={handleDrop}
                  onTap={handleTap}
                  onLongPress={handleLongPress}
                  columnLayouts={columnLayouts}
                />
              ))}
            </View>

          </View>
        </View>
      ) : null}

      <View
        style={styles.unavailableSection}
        onLayout={(e) => {
          columnLayouts.current.unavailable = e.nativeEvent.layout;
        }}
      >
        <View style={styles.columnHeader}>
          <Feather name="x-circle" size={18} color={AppColors.textDisabled} />
          <ThemedText type="body" style={{ color: AppColors.textDisabled }}>
            Unavailable
          </ThemedText>
          <ThemedText type="caption" style={styles.countBadge}>
            {unavailablePlayers.length}
          </ThemedText>
        </View>
        {unavailablePlayers.length > 0 ? (
          <View style={styles.playersList}>
            {unavailablePlayers.map((p) => (
              <DraggablePlayer
                key={p.id}
                player={p}
                status="unavailable"
                onDrop={handleDrop}
                onTap={handleTap}
                onLongPress={handleLongPress}
                columnLayouts={columnLayouts}
              />
            ))}
          </View>
        ) : (
          <View style={styles.unavailableEmpty}>
            <ThemedText type="small" style={{ color: AppColors.textDisabled }}>
              Drag players here if not available
            </ThemedText>
          </View>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.addPlayerButton,
          { opacity: pressed ? 0.8 : 1 },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowAddPlayerModal(true);
        }}
      >
        <Feather name="user-plus" size={18} color="#FFFFFF" />
        <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
          Add Player
        </ThemedText>
      </Pressable>

      <Modal
        visible={showAddPlayerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddPlayerModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAddPlayerModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Add New Player</ThemedText>
              <Pressable
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                onPress={() => setShowAddPlayerModal(false)}
              >
                <Feather name="x" size={24} color={AppColors.textSecondary} />
              </Pressable>
            </View>
            
            <View style={styles.modalInputGroup}>
              <ThemedText type="small" style={styles.modalLabel}>
                Player Name
              </ThemedText>
              <TextInput
                style={[styles.modalInput, { color: theme.text }]}
                value={newPlayerName}
                onChangeText={setNewPlayerName}
                placeholder="Enter player name"
                placeholderTextColor={AppColors.textDisabled}
                autoFocus
              />
            </View>

            <View style={styles.modalInputGroup}>
              <ThemedText type="small" style={styles.modalLabel}>
                Squad Number (Optional)
              </ThemedText>
              <TextInput
                style={[styles.modalInput, { color: theme.text }]}
                value={newPlayerNumber}
                onChangeText={setNewPlayerNumber}
                placeholder="e.g. 10"
                placeholderTextColor={AppColors.textDisabled}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonCancel,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => {
                  setNewPlayerName("");
                  setNewPlayerNumber("");
                  setShowAddPlayerModal(false);
                }}
              >
                <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSave,
                  !newPlayerName.trim() && styles.modalButtonDisabled,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={handleAddPlayer}
                disabled={!newPlayerName.trim()}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Add Player
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  matchInfoCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  inputLabel: {
    color: AppColors.textSecondary,
    marginRight: Spacing.sm,
    fontWeight: "600",
  },
  oppositionInput: {
    flex: 1,
    height: 40,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  locationButtons: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  optionButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.sm,
  },
  optionButtonActive: {
    backgroundColor: AppColors.pitchGreen,
  },
  optionText: {
    color: AppColors.textSecondary,
  },
  optionTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  formatButtons: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  formatButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.sm,
  },
  formatButtonActive: {
    backgroundColor: AppColors.pitchGreen,
  },
  formatText: {
    color: AppColors.textSecondary,
  },
  formatTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  durationLabel: {
    color: AppColors.textSecondary,
  },
  durationInput: {
    width: 60,
    height: 36,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  durationUnit: {
    color: AppColors.textSecondary,
  },
  hint: {
    color: AppColors.textDisabled,
    textAlign: "center",
    marginBottom: Spacing.md,
    fontStyle: "italic",
  },
  columnsContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  column: {
    flex: 1,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  countBadge: {
    color: AppColors.textSecondary,
    marginLeft: "auto",
  },
  playersList: {
    gap: Spacing.xs,
  },
  playerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minHeight: 48,
  },
  dragHandle: {
    marginRight: Spacing.xs,
  },
  playerAvatar: {
    width: 26,
    height: 26,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  playerName: {
    flex: 1,
    fontWeight: "600",
    fontSize: 14,
  },
  emptyColumn: {
    padding: Spacing.lg,
    alignItems: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: AppColors.pitchGreen,
    borderStyle: "dashed",
    gap: Spacing.sm,
  },
  unavailableSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: AppColors.elevated,
  },
  unavailableEmpty: {
    padding: Spacing.md,
    alignItems: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: AppColors.elevated,
    borderStyle: "dashed",
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  addPlayerButton: {
    flexDirection: "row",
    height: 48,
    backgroundColor: AppColors.pitchGreen,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  oppositionContainer: {
    flex: 1,
    position: "relative",
  },
  suggestionsDropdown: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: AppColors.elevated,
    zIndex: 100,
    elevation: 5,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.elevated,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: "100%",
    maxWidth: 340,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalInputGroup: {
    marginBottom: Spacing.lg,
  },
  modalLabel: {
    color: AppColors.textSecondary,
    marginBottom: Spacing.xs,
    fontWeight: "600",
  },
  modalInput: {
    height: 48,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: AppColors.elevated,
  },
  modalButtonSave: {
    backgroundColor: AppColors.pitchGreen,
  },
  modalButtonDisabled: {
    backgroundColor: AppColors.textDisabled,
  },
});
