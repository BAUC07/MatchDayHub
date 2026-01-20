import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
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
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, PlayerStatus>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

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

  const cyclePlayerStatus = useCallback((playerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayerStatuses((prev) => {
      const current = prev[playerId] || "bench";
      let next: PlayerStatus;
      
      if (current === "bench") {
        if (startingPlayers.length < maxPlayers) {
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
  }, [startingPlayers.length, maxPlayers]);

  const markNotPlaying = useCallback((playerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlayerStatuses((prev) => {
      const current = prev[playerId];
      if (current === "notPlaying") {
        return { ...prev, [playerId]: "bench" };
      }
      return { ...prev, [playerId]: "notPlaying" };
    });
  }, []);

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

  const renderPlayerCard = useCallback(
    (player: Player, status: PlayerStatus) => {
      let bgColor = AppColors.pitchGreen;
      let textColor = "#FFFFFF";
      
      if (status === "bench") {
        bgColor = "#2196F3";
      } else if (status === "notPlaying") {
        bgColor = AppColors.elevated;
        textColor = AppColors.textSecondary;
      }

      return (
        <Pressable
          key={player.id}
          style={({ pressed }) => [
            styles.playerCard,
            { backgroundColor: bgColor, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => cyclePlayerStatus(player.id)}
          onLongPress={() => markNotPlaying(player.id)}
          delayLongPress={400}
        >
          <View style={styles.playerAvatar}>
            <Feather name="user" size={16} color={AppColors.textSecondary} />
          </View>
          <ThemedText
            type="body"
            numberOfLines={1}
            style={[styles.playerName, { color: textColor }]}
          >
            {player.squadNumber ? `${player.squadNumber}. ` : ""}{player.name}
          </ThemedText>
        </Pressable>
      );
    },
    [cyclePlayerStatus, markNotPlaying]
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
      </Card>

      <ThemedText type="caption" style={styles.hint}>
        Tap to move between Starting/Bench. Long-press for Not Playing.
      </ThemedText>

      {allPlayers.length > 0 ? (
        <View style={styles.columnsContainer}>
          <View style={styles.column}>
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
              {startingPlayers.map((p) => renderPlayerCard(p, "starting"))}
              {startingPlayers.length === 0 ? (
                <View style={styles.emptyColumn}>
                  <ThemedText type="small" style={{ color: AppColors.textDisabled }}>
                    Tap players to add
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.column}>
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
              {benchPlayers.map((p) => renderPlayerCard(p, "bench"))}
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
                  {notPlayingPlayers.map((p) => renderPlayerCard(p, "notPlaying"))}
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
  playerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  playerName: {
    flex: 1,
    fontWeight: "600",
  },
  emptyColumn: {
    padding: Spacing.lg,
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
});
