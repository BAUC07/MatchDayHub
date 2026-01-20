import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
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
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Team, Player, Match, MatchFormat, MatchLocation } from "@/types";
import { getTeam, saveMatch, generateId } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MatchSetupRouteProp = RouteProp<RootStackParamList, "MatchSetup">;

type PlayerStatus = "starting" | "bench" | "notPlaying";

const FORMATS: MatchFormat[] = ["5v5", "7v7", "9v9", "11v11"];
const LOCATIONS: { key: MatchLocation; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "away", label: "Away" },
];
const GAME_DURATIONS = [20, 25, 30, 40, 45, 60, 70, 80, 90];

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
    const benchLayout = columnLayouts.current.bench;
    
    if (startingLayout && x < startingLayout.width + 20) {
      onDrop(playerId, "starting");
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
  const [gameDuration, setGameDuration] = useState(60);
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
  const notPlayingPlayers = allPlayers.filter((p) => playerStatuses[p.id] === "notPlaying");

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
        plannedDuration: gameDuration,
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
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <Card elevation={2} style={styles.matchInfoCard}>
        <View style={styles.inputRow}>
          <ThemedText type="small" style={styles.inputLabel}>VS</ThemedText>
          <TextInput
            style={[styles.oppositionInput, { color: theme.text }]}
            value={opposition}
            onChangeText={setOpposition}
            placeholder="Opposition team"
            placeholderTextColor={AppColors.textDisabled}
            maxLength={50}
          />
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
                      starting.slice(max).forEach((id) => {
                        updated[id] = "bench";
                      });
                      return updated;
                    }
                    return prev;
                  });
                }}
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.durationOptions}
          >
            {GAME_DURATIONS.map((mins) => (
              <Pressable
                key={mins}
                style={[
                  styles.durationButton,
                  gameDuration === mins && styles.durationButtonActive,
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setGameDuration(mins);
                }}
              >
                <ThemedText
                  type="small"
                  style={[
                    styles.durationText,
                    gameDuration === mins && styles.durationTextActive,
                  ]}
                >
                  {mins}m
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
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
                  columnLayouts={columnLayouts}
                />
              ))}
            </View>

            {notPlayingPlayers.length > 0 ? (
              <>
                <View style={[styles.columnHeader, { marginTop: Spacing.lg }]}>
                  <Feather name="x" size={18} color={AppColors.textSecondary} />
                  <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
                    Not Playing
                  </ThemedText>
                  <ThemedText type="caption" style={styles.countBadge}>
                    {notPlayingPlayers.length}
                  </ThemedText>
                </View>
                <View style={styles.playersList}>
                  {notPlayingPlayers.map((p) => (
                    <DraggablePlayer
                      key={p.id}
                      player={p}
                      status="notPlaying"
                      onDrop={handleDrop}
                      onTap={handleTap}
                      columnLayouts={columnLayouts}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>
      ) : (
        <Card elevation={2} style={styles.emptyCard}>
          <Feather name="alert-circle" size={24} color={AppColors.warningYellow} />
          <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
            No players in squad
          </ThemedText>
          <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
            Go back to add players to your team first
          </ThemedText>
        </Card>
      )}
    </ScrollView>
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
  durationOptions: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingRight: Spacing.md,
  },
  durationButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor: AppColors.elevated,
    borderRadius: BorderRadius.sm,
  },
  durationButtonActive: {
    backgroundColor: AppColors.pitchGreen,
  },
  durationText: {
    color: AppColors.textSecondary,
  },
  durationTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
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
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
});
