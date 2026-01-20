import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  LayoutRectangle,
} from "react-native";
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
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Team, Player, Match, MatchFormat, MatchLocation } from "@/types";
import { getTeam, saveMatch, generateId } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MatchSetupRouteProp = RouteProp<RootStackParamList, "MatchSetup">;

type PlayerStatus = "starting" | "bench" | "notPlaying";

const FORMATS: MatchFormat[] = ["5v5", "7v7", "9v9", "11v11"];

interface DraggablePlayerProps {
  player: Player;
  status: PlayerStatus;
  onDrop: (playerId: string, targetStatus: PlayerStatus) => void;
  onTap: (playerId: string) => void;
  columnLayouts: React.MutableRefObject<{ starting: LayoutRectangle | null; bench: LayoutRectangle | null }>;
}

function DraggablePlayer({ player, status, onDrop, onTap, columnLayouts }: DraggablePlayerProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleDrop = (playerId: string, x: number) => {
    const startingLayout = columnLayouts.current.starting;
    
    if (startingLayout && x < startingLayout.width + 20) {
      onDrop(playerId, "starting");
    } else {
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
      
      const finalX = event.absoluteX;
      runOnJS(handleDrop)(player.id, finalX);
      
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onTap)(player.id);
  });

  const composed = Gesture.Race(gesture, tap);

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
  } else if (status === "notPlaying") {
    bgColor = AppColors.elevated;
    textColor = AppColors.textSecondary;
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
        <ThemedText
          type="small"
          numberOfLines={1}
          style={[styles.playerName, { color: textColor }]}
        >
          {player.squadNumber ? `${player.squadNumber}` : "-"}
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
  const [gameDuration, setGameDuration] = useState("60");
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, PlayerStatus>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const columnLayouts = useRef<{ starting: LayoutRectangle | null; bench: LayoutRectangle | null }>({
    starting: null,
    bench: null,
  });

  const loadTeam = useCallback(async () => {
    try {
      const teamData = await getTeam(route.params.teamId);
      if (teamData) {
        setTeam(teamData);
        const initialStatuses: Record<string, PlayerStatus> = {};
        teamData.players.forEach((p) => {
          initialStatuses[p.id] = "bench";
        });
        setPlayerStatuses(initialStatuses);
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

  const allPlayers = team?.players || [];
  const startingPlayers = allPlayers.filter((p) => playerStatuses[p.id] === "starting");
  const benchPlayers = allPlayers.filter((p) => playerStatuses[p.id] === "bench");

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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return prev;
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
        events: [],
        scoreFor: 0,
        scoreAgainst: 0,
        isCompleted: false,
        totalMatchTime: 0,
        addedTime: 0,
        plannedDuration: parseInt(gameDuration, 10) || 60,
      };

      await saveMatch(match);
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundRoot,
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing.md,
          paddingHorizontal: Spacing.md,
        },
      ]}
    >
      <View style={styles.topSection}>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.oppositionInput, { color: theme.text }]}
            value={opposition}
            onChangeText={setOpposition}
            placeholder="Opposition"
            placeholderTextColor={AppColors.textDisabled}
            maxLength={30}
          />
          <View style={styles.locationButtons}>
            <Pressable
              style={[styles.locButton, location === "home" && styles.locButtonActive]}
              onPress={() => { Haptics.selectionAsync(); setLocation("home"); }}
            >
              <ThemedText type="caption" style={location === "home" ? styles.locTextActive : styles.locText}>H</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.locButton, location === "away" && styles.locButtonActive]}
              onPress={() => { Haptics.selectionAsync(); setLocation("away"); }}
            >
              <ThemedText type="caption" style={location === "away" ? styles.locTextActive : styles.locText}>A</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.settingsRow}>
          <View style={styles.formatButtons}>
            {FORMATS.map((f) => (
              <Pressable
                key={f}
                style={[styles.formatButton, format === f && styles.formatButtonActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFormat(f);
                  setPlayerStatuses((prev) => {
                    const max = getMaxPlayers(f);
                    const starting = Object.entries(prev)
                      .filter(([, s]) => s === "starting")
                      .map(([id]) => id);
                    if (starting.length > max) {
                      const updated = { ...prev };
                      starting.slice(max).forEach((id) => { updated[id] = "bench"; });
                      return updated;
                    }
                    return prev;
                  });
                }}
              >
                <ThemedText type="caption" style={format === f ? styles.formatTextActive : styles.formatText}>{f}</ThemedText>
              </Pressable>
            ))}
          </View>
          <View style={styles.timeInput}>
            <Feather name="clock" size={14} color={AppColors.textSecondary} />
            <TextInput
              style={[styles.durationInput, { color: theme.text }]}
              value={gameDuration}
              onChangeText={(t) => setGameDuration(t.replace(/[^0-9]/g, ""))}
              placeholder="60"
              placeholderTextColor={AppColors.textDisabled}
              keyboardType="number-pad"
              maxLength={3}
            />
            <ThemedText type="caption" style={{ color: AppColors.textSecondary }}>m</ThemedText>
          </View>
        </View>
      </View>

      {allPlayers.length > 0 ? (
        <View style={styles.columnsContainer}>
          <View
            style={styles.column}
            onLayout={(e) => { columnLayouts.current.starting = e.nativeEvent.layout; }}
          >
            <View style={styles.columnHeader}>
              <Feather name="play" size={14} color={AppColors.pitchGreen} />
              <ThemedText type="small" style={{ color: AppColors.pitchGreen }}>Starting</ThemedText>
              <ThemedText type="caption" style={styles.countBadge}>{startingPlayers.length}/{maxPlayers}</ThemedText>
            </View>
            <View style={styles.playersList}>
              {startingPlayers.map((p) => (
                <DraggablePlayer key={p.id} player={p} status="starting" onDrop={handleDrop} onTap={handleTap} columnLayouts={columnLayouts} />
              ))}
              {startingPlayers.length === 0 ? (
                <View style={styles.emptyColumn}>
                  <ThemedText type="caption" style={{ color: AppColors.textDisabled }}>Tap to add</ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={styles.column}
            onLayout={(e) => { columnLayouts.current.bench = e.nativeEvent.layout; }}
          >
            <View style={styles.columnHeader}>
              <Feather name="users" size={14} color="#2196F3" />
              <ThemedText type="small" style={{ color: "#2196F3" }}>Bench</ThemedText>
              <ThemedText type="caption" style={styles.countBadge}>{benchPlayers.length}</ThemedText>
            </View>
            <View style={styles.playersList}>
              {benchPlayers.map((p) => (
                <DraggablePlayer key={p.id} player={p} status="bench" onDrop={handleDrop} onTap={handleTap} columnLayouts={columnLayouts} />
              ))}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Feather name="alert-circle" size={24} color={AppColors.warningYellow} />
          <ThemedText type="body" style={{ color: AppColors.textSecondary }}>No players in squad</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topSection: {
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  oppositionInput: {
    flex: 1,
    height: 40,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  locationButtons: {
    flexDirection: "row",
    gap: 4,
  },
  locButton: {
    width: 36,
    height: 40,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  locButtonActive: {
    backgroundColor: AppColors.pitchGreen,
  },
  locText: {
    color: AppColors.textSecondary,
    fontWeight: "600",
  },
  locTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  formatButtons: {
    flexDirection: "row",
    gap: 4,
  },
  formatButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: AppColors.surface,
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
  timeInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AppColors.surface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  durationInput: {
    width: 36,
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
  columnsContainer: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  column: {
    flex: 1,
  },
  columnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.xs,
  },
  countBadge: {
    color: AppColors.textSecondary,
    marginLeft: "auto",
  },
  playersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  playerCard: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  playerName: {
    fontWeight: "700",
    fontSize: 14,
  },
  emptyColumn: {
    padding: Spacing.md,
    alignItems: "center",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: AppColors.pitchGreen,
    borderStyle: "dashed",
    width: "100%",
  },
  emptyCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
});
