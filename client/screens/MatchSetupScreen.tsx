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
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadTeam = useCallback(async () => {
    try {
      const teamData = await getTeam(route.params.teamId);
      setTeam(teamData);
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

  const startingPlayers = team?.players.filter((p) => p.state === "starting") || [];
  const substitutes = team?.players.filter((p) => p.state === "substitute") || [];

  const isValid = opposition.trim().length >= 1 && startingPlayers.length > 0;

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
        substitutes: substitutes.map((p) => p.id),
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
    substitutes,
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
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <ThemedText type="small" style={styles.label}>
        OPPOSITION
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: AppColors.surface,
            color: theme.text,
          },
        ]}
        value={opposition}
        onChangeText={setOpposition}
        placeholder="Enter team name"
        placeholderTextColor={AppColors.textDisabled}
        autoFocus
        maxLength={50}
      />

      <ThemedText type="small" style={styles.label}>
        LOCATION
      </ThemedText>
      <View style={styles.segmentedControl}>
        {LOCATIONS.map((loc) => (
          <Pressable
            key={loc.key}
            style={[
              styles.segment,
              location === loc.key && styles.segmentActive,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setLocation(loc.key);
            }}
          >
            <ThemedText
              type="body"
              style={[
                styles.segmentText,
                location === loc.key && styles.segmentTextActive,
              ]}
            >
              {loc.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText type="small" style={styles.label}>
        FORMAT
      </ThemedText>
      <View style={styles.formatGrid}>
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
            }}
          >
            <ThemedText
              type="body"
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

      <ThemedText type="small" style={styles.label}>
        STARTING LINEUP ({startingPlayers.length})
      </ThemedText>
      <Card elevation={2} style={styles.lineupCard}>
        {startingPlayers.length > 0 ? (
          <View style={styles.playerChips}>
            {startingPlayers.map((player) => (
              <View key={player.id} style={styles.playerChip}>
                <ThemedText type="small" style={styles.chipNumber}>
                  {player.squadNumber ?? "-"}
                </ThemedText>
                <ThemedText type="small" numberOfLines={1}>
                  {player.name}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyLineup}>
            <Feather name="alert-circle" size={20} color={AppColors.warningYellow} />
            <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
              No starting players. Go back to edit squad.
            </ThemedText>
          </View>
        )}
      </Card>

      {substitutes.length > 0 ? (
        <>
          <ThemedText type="small" style={styles.label}>
            SUBSTITUTES ({substitutes.length})
          </ThemedText>
          <Card elevation={2} style={styles.lineupCard}>
            <View style={styles.playerChips}>
              {substitutes.map((player) => (
                <View key={player.id} style={[styles.playerChip, styles.subChip]}>
                  <ThemedText type="small" style={styles.chipNumber}>
                    {player.squadNumber ?? "-"}
                  </ThemedText>
                  <ThemedText type="small" numberOfLines={1}>
                    {player.name}
                  </ThemedText>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    color: AppColors.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    marginBottom: Spacing.xl,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.xl,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: AppColors.pitchGreen,
  },
  segmentText: {
    color: AppColors.textSecondary,
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  formatGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  formatButton: {
    flex: 1,
    minWidth: "22%",
    paddingVertical: Spacing.md,
    backgroundColor: AppColors.surface,
    borderRadius: BorderRadius.md,
    alignItems: "center",
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
  lineupCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  playerChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  playerChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AppColors.elevated,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderLeftWidth: 3,
    borderLeftColor: AppColors.pitchGreen,
  },
  subChip: {
    borderLeftColor: AppColors.warningYellow,
  },
  chipNumber: {
    fontWeight: "600",
    marginRight: Spacing.sm,
    color: AppColors.textSecondary,
  },
  emptyLineup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
