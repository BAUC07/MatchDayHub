import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
  FlatList,
  Alert,
  ScrollView,
  LayoutChangeEvent,
  AppState,
  AppStateStatus,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector, Swipeable } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Match, Team, Player, MatchEvent, GoalType, CardType } from "@/types";
import { getMatch, saveMatch, getTeam, saveTeam, generateId } from "@/lib/storage";
import { formatMatchTime, getPlayerDisplayName } from "@/lib/utils";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type LiveMatchRouteProp = RouteProp<RootStackParamList, "LiveMatch">;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ActionType = "goal_for" | "goal_against" | "card" | "penalty" | "sub";

// LiveTimer: Standalone component with isolated state management
// NOT wrapped in React.memo - manages its own re-renders independently
interface LiveTimerProps {
  startTimestamp: number | null;
  isRunning: boolean;
  baseTime: number;
  plannedDuration: number;
  isSecondHalf: boolean;
  firstHalfAddedTime: number;
}

function LiveTimer({ 
  startTimestamp: startTimestampProp, 
  isRunning, 
  baseTime, 
  plannedDuration, 
  isSecondHalf, 
  firstHalfAddedTime 
}: LiveTimerProps) {
  // Counter to force component re-renders every second (value unused but state change triggers re-render)
  const [, setTick] = useState(0);
  
  // Timer that updates state every second to force re-renders and recalculate elapsed time
  useEffect(() => {
    if (isRunning) {
      const id = setInterval(() => {
        setTick(prev => prev + 1);
      }, 1000);
      return () => clearInterval(id);
    }
  }, [isRunning, startTimestampProp]);
  
  // Calculate elapsed time from timestamp on each render
  const now = Date.now();
  let matchTime: number;
  if (!isRunning || !startTimestampProp) {
    matchTime = baseTime;
  } else {
    const elapsed = Math.floor((now - startTimestampProp) / 1000);
    matchTime = baseTime + elapsed;
  }
  const halfDuration = plannedDuration / 2;
  const halfMins = Math.floor(halfDuration / 60);
  const fullMins = Math.floor(plannedDuration / 60);
  
  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  let mainDisplay: string;
  let addedDisplay: string = '';
  
  if (!isSecondHalf) {
    if (matchTime <= halfDuration) {
      mainDisplay = formatTime(matchTime);
    } else {
      const addedSecs = matchTime - halfDuration;
      const addedMins = Math.floor(addedSecs / 60);
      const addedRemSecs = addedSecs % 60;
      mainDisplay = `${halfMins}'`;
      addedDisplay = `+${addedMins}:${addedRemSecs.toString().padStart(2, '0')}`;
    }
  } else {
    const secondHalfTime = matchTime - halfDuration - firstHalfAddedTime;
    const displayTime = halfDuration + secondHalfTime;
    
    if (displayTime <= plannedDuration) {
      mainDisplay = formatTime(displayTime);
    } else {
      const addedSecs = displayTime - plannedDuration;
      const addedMins = Math.floor(addedSecs / 60);
      const addedRemSecs = addedSecs % 60;
      mainDisplay = `${fullMins}'`;
      addedDisplay = `+${addedMins}:${addedRemSecs.toString().padStart(2, '0')}`;
    }
  }
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <ThemedText type="h2" style={{ color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
        {mainDisplay}
      </ThemedText>
      {addedDisplay ? (
        <ThemedText type="body" style={{ color: AppColors.pitchGreen, fontWeight: '700' }}>
          {addedDisplay}
        </ThemedText>
      ) : null}
    </View>
  );
}

interface PlayerPosition {
  playerId: string;
  x: number;
  y: number;
}

interface DraggablePlayerProps {
  player: Player;
  position: { x: number; y: number };
  pitchDimensions: { width: number; height: number };
  onPositionChange: (playerId: string, x: number, y: number) => void;
  onTap: () => void;
}

function DraggablePlayer({ player, position, pitchDimensions, onPositionChange, onTap }: DraggablePlayerProps) {
  const translateX = useSharedValue(position.x);
  const translateY = useSharedValue(position.y);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    translateX.value = position.x;
    translateY.value = position.y;
  }, [position.x, position.y]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      scale.value = withSpring(1.2);
      runOnJS(Haptics.selectionAsync)();
    })
    .onUpdate((event) => {
      const newX = startX.value + event.translationX;
      const newY = startY.value + event.translationY;
      const playerSize = 50;
      translateX.value = Math.max(0, Math.min(pitchDimensions.width - playerSize, newX));
      translateY.value = Math.max(0, Math.min(pitchDimensions.height - playerSize, newY));
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      runOnJS(onPositionChange)(player.id, translateX.value, translateY.value);
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      runOnJS(Haptics.selectionAsync)();
      runOnJS(onTap)();
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.draggablePlayerCircle, animatedStyle]}>
        <ThemedText type="small" style={styles.playerCircleText}>
          {getPlayerDisplayName(player)}
        </ThemedText>
      </Animated.View>
    </GestureDetector>
  );
}

export default function LiveMatchScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LiveMatchRouteProp>();

  const [match, setMatch] = useState<Match | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [baseTime, setBaseTime] = useState(0); // Accumulated time when timer was last stopped
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null); // When timer was started (state, not ref)
  
  // Debug: Log on every render
  console.log('[Render] LiveMatchScreen rendered, isRunning:', isRunning, 'baseTime:', baseTime, 'startTimestamp:', timerStartTimestamp);
  
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isHalfTime, setIsHalfTime] = useState(false);
  const [isSecondHalf, setIsSecondHalf] = useState(false);
  const [firstHalfAddedTime, setFirstHalfAddedTime] = useState(0);
  const [secondHalfAddedTime, setSecondHalfAddedTime] = useState(0);
  const [playerPositions, setPlayerPositions] = useState<PlayerPosition[]>([]);
  const [pitchDimensions, setPitchDimensions] = useState({ width: 0, height: 0 });

  const lastSaveRef = useRef<number>(0);

  const loadData = useCallback(async () => {
    try {
      const matchData = await getMatch(route.params.matchId);
      if (matchData) {
        setMatch(matchData);
        setIsHalfTime(matchData.isHalfTime || false);
        setIsSecondHalf(matchData.halfTimeTriggered || false);
        setFirstHalfAddedTime(matchData.firstHalfAddedTime || 0);
        setSecondHalfAddedTime(matchData.secondHalfAddedTime || 0);
        
        // Restore timer state - if timer was running, restore using state
        if (matchData.timerStartTimestamp && !matchData.isHalfTime && !matchData.isCompleted) {
          setBaseTime(matchData.accumulatedTime || 0);
          setTimerStartTimestamp(matchData.timerStartTimestamp);
          setIsRunning(true);
        } else {
          setBaseTime(matchData.totalMatchTime || 0);
          setTimerStartTimestamp(null);
        }
        
        const teamData = await getTeam(matchData.teamId);
        setTeam(teamData);
      }
    } catch (error) {
      console.error("Error loading match:", error);
    } finally {
      setLoading(false);
    }
  }, [route.params.matchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Timer display is now handled by LiveTimer component - no need for parent timer effect
  // LiveTimer manages its own re-renders and calculates time from startTimestamp

  // Helper to calculate current match time
  const getCurrentMatchTime = useCallback(() => {
    if (!isRunning || !timerStartTimestamp) {
      return baseTime;
    }
    const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000);
    return baseTime + elapsed;
  }, [isRunning, timerStartTimestamp, baseTime]);

  useEffect(() => {
    const now = Date.now();
    if (match && now - lastSaveRef.current > 5000) {
      lastSaveRef.current = now;
      const currentTime = getCurrentMatchTime();
      const updatedMatch = {
        ...match,
        totalMatchTime: currentTime,
        isHalfTime,
        halfTimeTriggered: isSecondHalf,
        firstHalfAddedTime,
        secondHalfAddedTime,
        timerStartTimestamp: isRunning && timerStartTimestamp ? timerStartTimestamp : undefined,
        accumulatedTime: baseTime,
      };
      saveMatch(updatedMatch);
    }
  }, [baseTime, timerStartTimestamp, match, isHalfTime, isSecondHalf, firstHalfAddedTime, secondHalfAddedTime, isRunning, getCurrentMatchTime]);

  const plannedDuration = (match?.plannedDuration || 60) * 60;
  const halfDuration = plannedDuration / 2;

  // getTimeDisplay removed - LiveTimer component handles time display

  const handleToggleClock = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isHalfTime) {
      // Resuming from half-time into second half
      const currentTime = getCurrentMatchTime();
      setIsHalfTime(false);
      setIsSecondHalf(true);
      setFirstHalfAddedTime(currentTime > halfDuration ? currentTime - halfDuration : 0);
    }
    
    if (!isRunning) {
      // Starting the timer
      setTimerStartTimestamp(Date.now());
      setIsRunning(true);
    } else {
      // Stopping the timer - accumulate elapsed time
      if (timerStartTimestamp) {
        const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000);
        setBaseTime(prev => prev + elapsed);
      }
      setTimerStartTimestamp(null);
      setIsRunning(false);
    }
  }, [isHalfTime, isRunning, timerStartTimestamp, getCurrentMatchTime, halfDuration]);

  const handleHalfTime = useCallback(() => {
    const currentTime = getCurrentMatchTime();
    
    if (isHalfTime) {
      // During half time, clicking HT starts the second half
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsHalfTime(false);
      setIsSecondHalf(true);
      if (currentTime > halfDuration) {
        setFirstHalfAddedTime(currentTime - halfDuration);
      }
      // Start the timer for second half
      setTimerStartTimestamp(Date.now());
      setIsRunning(true);
    } else if (!isSecondHalf) {
      // During first half, trigger half time break
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Stop the timer and save accumulated time
      if (timerStartTimestamp) {
        const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000);
        setBaseTime(prev => prev + elapsed);
      }
      setTimerStartTimestamp(null);
      setIsRunning(false);
      setIsHalfTime(true);
      if (currentTime > halfDuration) {
        setFirstHalfAddedTime(currentTime - halfDuration);
      }
    }
  }, [isHalfTime, isSecondHalf, getCurrentMatchTime, halfDuration, timerStartTimestamp]);

  const handlePauseLongPress = useCallback(() => {
    if (isRunning) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      // Stop the timer and save accumulated time
      if (timerStartTimestamp) {
        const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000);
        setBaseTime(prev => prev + elapsed);
      }
      setTimerStartTimestamp(null);
      setIsRunning(false);
    }
  }, [isRunning, timerStartTimestamp]);

  const openActionSheet = useCallback((action: ActionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentAction(action);
    setSelectedPlayer(null);
    setShowActionSheet(true);
  }, []);

  const getPlayersOnPitch = useCallback(() => {
    if (!team || !match) return [];
    const onPitchIds = new Set(match.startingLineup);

    match.events
      .filter((e) => e.type === "substitution")
      .forEach((e) => {
        if (e.playerOffId) onPitchIds.delete(e.playerOffId);
        if (e.playerOnId) onPitchIds.add(e.playerOnId);
      });

    return team.players.filter((p) => onPitchIds.has(p.id));
  }, [team, match]);

  const getSubstitutes = useCallback(() => {
    if (!team || !match) return [];
    const onPitchIds = new Set(match.startingLineup);

    match.events
      .filter((e) => e.type === "substitution")
      .forEach((e) => {
        if (e.playerOffId) onPitchIds.delete(e.playerOffId);
        if (e.playerOnId) onPitchIds.add(e.playerOnId);
      });

    // Include both original subs AND players who were subbed off (now available again)
    const availablePlayerIds = new Set([...match.substitutes, ...match.startingLineup]);
    return team.players.filter(
      (p) => !onPitchIds.has(p.id) && availablePlayerIds.has(p.id)
    );
  }, [team, match]);

  const addEvent = useCallback(
    async (event: Omit<MatchEvent, "id" | "timestamp">) => {
      if (!match) return;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const currentTime = getCurrentMatchTime();
      const newEvent: MatchEvent = {
        ...event,
        id: generateId(),
        timestamp: currentTime,
      };

      let scoreFor = match.scoreFor;
      let scoreAgainst = match.scoreAgainst;

      if (event.type === "goal_for") {
        scoreFor += 1;
      } else if (event.type === "goal_against") {
        scoreAgainst += 1;
      }

      const updatedMatch = {
        ...match,
        events: [...match.events, newEvent],
        scoreFor,
        scoreAgainst,
        totalMatchTime: currentTime,
      };

      setMatch(updatedMatch);
      await saveMatch(updatedMatch);
    },
    [match, getCurrentMatchTime]
  );

  const handleGoalFor = useCallback(
    async (scorer: Player, goalType: GoalType, assist?: Player) => {
      await addEvent({
        type: "goal_for",
        playerId: scorer.id,
        assistPlayerId: assist?.id,
        goalType,
      });
      setShowActionSheet(false);
    },
    [addEvent]
  );

  const handleGoalAgainst = useCallback(
    async (goalType: GoalType) => {
      await addEvent({
        type: "goal_against",
        goalType,
      });
      setShowActionSheet(false);
    },
    [addEvent]
  );

  const handleCard = useCallback(
    async (player: Player, cardType: CardType) => {
      await addEvent({
        type: "card",
        playerId: player.id,
        cardType,
      });
      setShowActionSheet(false);
    },
    [addEvent]
  );

  const handleSubstitution = useCallback(
    async (playerOff: Player, playerOn: Player) => {
      await addEvent({
        type: "substitution",
        playerOffId: playerOff.id,
        playerOnId: playerOn.id,
      });
      setShowActionSheet(false);
    },
    [addEvent]
  );

  const handlePenalty = useCallback(
    async (isFor: boolean, outcome?: "scored" | "saved", scorerId?: string) => {
      await addEvent({
        type: "penalty",
        isForTeam: isFor,
        penaltyOutcome: outcome,
        playerId: scorerId,
      });
      setShowActionSheet(false);
    },
    [addEvent]
  );

  const handleDeleteMatchEvent = useCallback((eventId: string) => {
    if (!match) return;
    
    const eventToDelete = match.events.find(e => e.id === eventId);
    if (!eventToDelete) return;

    let newScoreFor = match.scoreFor;
    let newScoreAgainst = match.scoreAgainst;

    if (eventToDelete.type === "goal_for") {
      newScoreFor = Math.max(0, newScoreFor - 1);
    } else if (eventToDelete.type === "goal_against") {
      newScoreAgainst = Math.max(0, newScoreAgainst - 1);
    } else if (eventToDelete.type === "penalty") {
      if (eventToDelete.penaltyOutcome === "scored") {
        if (eventToDelete.isForTeam) {
          newScoreFor = Math.max(0, newScoreFor - 1);
        } else {
          newScoreAgainst = Math.max(0, newScoreAgainst - 1);
        }
      }
    }

    const updatedEvents = match.events.filter(e => e.id !== eventId);
    
    const updatedMatch: Match = {
      ...match,
      events: updatedEvents,
      scoreFor: newScoreFor,
      scoreAgainst: newScoreAgainst,
    };

    setMatch(updatedMatch);
    saveMatch(updatedMatch);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [match]);

  const handleEndMatch = useCallback(() => {
    if (!match || !team) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowEndConfirm(true);
  }, [match, team]);

  const confirmEndMatch = useCallback(async () => {
    if (!match || !team) return;
    
    setShowEndConfirm(false);
    setIsRunning(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const result =
      match.scoreFor > match.scoreAgainst
        ? "win"
        : match.scoreFor < match.scoreAgainst
          ? "loss"
          : "draw";

    const currentTime = getCurrentMatchTime();
    const updatedMatch: Match = {
      ...match,
      isCompleted: true,
      totalMatchTime: currentTime,
    };

    const updatedTeam: Team = {
      ...team,
      matchesPlayed: team.matchesPlayed + 1,
      wins: team.wins + (result === "win" ? 1 : 0),
      draws: team.draws + (result === "draw" ? 1 : 0),
      losses: team.losses + (result === "loss" ? 1 : 0),
      lastMatchDate: match.date,
    };

    try {
      await saveMatch(updatedMatch);
      await saveTeam(updatedTeam);
      navigation.replace("MatchSummary", { matchId: match.id });
    } catch (error) {
      console.error("Error ending match:", error);
    }
  }, [match, team, getCurrentMatchTime, navigation]);

  const undoLastEvent = useCallback(() => {
    if (!match || match.events.length === 0) return;

    Alert.alert("Undo Last Event", "Remove the most recent event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Undo",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          const lastEvent = match.events[match.events.length - 1];
          let scoreFor = match.scoreFor;
          let scoreAgainst = match.scoreAgainst;

          if (lastEvent.type === "goal_for") {
            scoreFor -= 1;
          } else if (lastEvent.type === "goal_against") {
            scoreAgainst -= 1;
          }

          const updatedMatch = {
            ...match,
            events: match.events.slice(0, -1),
            scoreFor,
            scoreAgainst,
          };

          setMatch(updatedMatch);
          await saveMatch(updatedMatch);
        },
      },
    ]);
  }, [match]);

  const playersOnPitch = getPlayersOnPitch();
  const substitutes = getSubstitutes();

  const getDefaultPosition = useCallback((index: number, totalPlayers: number): { x: number; y: number } => {
    const cols = 4;
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      x: 0.15 + col * 0.23,
      y: 0.15 + row * 0.28,
    };
  }, []);

  useEffect(() => {
    if (playersOnPitch.length > 0 && pitchDimensions.width > 0) {
      setPlayerPositions((prev) => {
        const existingIds = new Set(prev.map(p => p.playerId));
        const currentIds = new Set(playersOnPitch.map(p => p.id));
        
        const filtered = prev.filter(p => currentIds.has(p.playerId));
        
        const newPositions = playersOnPitch
          .filter(p => !existingIds.has(p.id))
          .map((player, idx) => {
            const totalNew = playersOnPitch.filter(p => !existingIds.has(p.id)).length;
            const existingCount = filtered.length;
            const pos = getDefaultPosition(existingCount + idx, playersOnPitch.length);
            return {
              playerId: player.id,
              x: pos.x * pitchDimensions.width,
              y: pos.y * pitchDimensions.height,
            };
          });
        
        return [...filtered, ...newPositions];
      });
    }
  }, [playersOnPitch, pitchDimensions, getDefaultPosition]);

  const updatePlayerPosition = useCallback((playerId: string, x: number, y: number) => {
    setPlayerPositions((prev) => 
      prev.map(p => p.playerId === playerId ? { ...p, x, y } : p)
    );
  }, []);

  const handlePitchLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPitchDimensions({ width, height });
  }, []);

  if (loading || !match || !team) {
    return (
      <View style={[styles.container, { backgroundColor: AppColors.darkBg }]}>
        <View style={styles.loadingContainer}>
          <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
            Loading...
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: AppColors.darkBg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.topBarLeft}>
          <Pressable
            onPress={() => setShowTimeline(true)}
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="list" size={22} color={AppColors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.scoreSection}>
          <ThemedText type="h1" style={styles.scoreText}>
            {match.scoreFor}
          </ThemedText>
          <ThemedText type="h3" style={styles.scoreDivider}>
            -
          </ThemedText>
          <ThemedText type="h1" style={styles.scoreText}>
            {match.scoreAgainst}
          </ThemedText>
        </View>

        <View style={styles.topBarRight}>
          <Pressable
            onPress={undoLastEvent}
            disabled={match.events.length === 0}
            hitSlop={8}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather
              name="rotate-ccw"
              size={20}
              color={
                match.events.length > 0
                  ? AppColors.textSecondary
                  : AppColors.textDisabled
              }
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.clockSection}>
        <LiveTimer
          startTimestamp={timerStartTimestamp}
          isRunning={isRunning}
          baseTime={baseTime}
          plannedDuration={(match?.plannedDuration || 60) * 60}
          isSecondHalf={isSecondHalf}
          firstHalfAddedTime={firstHalfAddedTime}
        />
        <Pressable
          onPress={handleToggleClock}
          onLongPress={handlePauseLongPress}
          delayLongPress={800}
          style={({ pressed }) => [
            styles.clockButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather
            name={isRunning ? "pause" : "play"}
            size={20}
            color="#FFFFFF"
          />
        </Pressable>
      </View>

      {isHalfTime ? (
        <View style={styles.halfTimeIndicator}>
          <ThemedText type="body" style={styles.halfTimeText}>HALF TIME</ThemedText>
        </View>
      ) : (
        <View style={styles.periodIndicator}>
          <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
            {isSecondHalf ? "2nd Half" : "1st Half"}
          </ThemedText>
        </View>
      )}

      <View style={styles.teamsRow}>
        <ThemedText type="small" style={styles.teamLabel}>
          {team.name}
        </ThemedText>
        <ThemedText type="small" style={styles.vsLabel}>
          vs
        </ThemedText>
        <ThemedText type="small" style={styles.teamLabel}>
          {match.opposition}
        </ThemedText>
      </View>

      <View style={styles.middleZone}>
        <View style={styles.pitchContainer}>
          <View style={styles.pitch} onLayout={handlePitchLayout}>
            <View style={styles.pitchCenterCircle} />
            <View style={styles.pitchCenterLine} />
            <View style={styles.pitchGoalAreaTop} />
            <View style={styles.pitchGoalAreaBottom} />

            <View style={styles.playersGrid}>
              {playersOnPitch.map((player) => {
                const pos = playerPositions.find(p => p.playerId === player.id);
                if (!pos) return null;
                return (
                  <DraggablePlayer
                    key={player.id}
                    player={player}
                    position={{ x: pos.x, y: pos.y }}
                    pitchDimensions={pitchDimensions}
                    onPositionChange={updatePlayerPosition}
                    onTap={() => {
                      setSelectedPlayer(player);
                      setCurrentAction("goal_for");
                      setShowActionSheet(true);
                    }}
                  />
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.benchContainer}>
          <ThemedText type="small" style={styles.benchLabel}>
            BENCH
          </ThemedText>
          <FlatList
            horizontal
            data={substitutes}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.benchList}
            renderItem={({ item }) => (
              <View style={styles.benchPlayer}>
                <ThemedText type="small" style={styles.benchPlayerText}>
                  {getPlayerDisplayName(item)}
                </ThemedText>
              </View>
            )}
            ListEmptyComponent={
              <ThemedText
                type="small"
                style={{ color: AppColors.textDisabled }}
              >
                No subs available
              </ThemedText>
            }
          />
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <View style={styles.actionButtonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.goalButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => openActionSheet("goal_for")}
          >
            <ThemedText type="body" style={styles.actionButtonText}>
              GOAL +
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.goalAgainstButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => openActionSheet("goal_against")}
          >
            <ThemedText type="body" style={styles.actionButtonText}>
              GOAL -
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.cardButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => openActionSheet("card")}
          >
            <ThemedText type="body" style={styles.actionButtonText}>
              CARD
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.actionButtonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.subButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => openActionSheet("sub")}
          >
            <ThemedText type="body" style={styles.actionButtonText}>
              SUB
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.penaltyButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => openActionSheet("penalty")}
          >
            <ThemedText type="body" style={styles.actionButtonText}>
              PENALTY
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              isSecondHalf ? styles.endButton : styles.halfTimeButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={isSecondHalf ? handleEndMatch : handleHalfTime}
          >
            <ThemedText type="body" style={styles.actionButtonText}>
              {isSecondHalf ? "END" : isHalfTime ? "2nd" : "HT"}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <ActionSheet
        visible={showActionSheet}
        action={currentAction}
        players={playersOnPitch}
        substitutes={substitutes}
        selectedPlayer={selectedPlayer}
        onClose={() => setShowActionSheet(false)}
        onGoalFor={handleGoalFor}
        onGoalAgainst={handleGoalAgainst}
        onCard={handleCard}
        onSubstitution={handleSubstitution}
        onPenalty={handlePenalty}
      />

      <TimelineSheet
        visible={showTimeline}
        events={match.events}
        players={team.players}
        onClose={() => setShowTimeline(false)}
        onDeleteEvent={handleDeleteMatchEvent}
      />

      <Modal visible={showEndConfirm} transparent animationType="fade" onRequestClose={() => setShowEndConfirm(false)}>
        <View style={confirmStyles.overlay}>
          <View style={confirmStyles.dialog}>
            <ThemedText type="h4" style={confirmStyles.title}>End Match?</ThemedText>
            <ThemedText type="body" style={confirmStyles.message}>
              Are you sure you want to end this game?
            </ThemedText>
            <View style={confirmStyles.buttons}>
              <Pressable style={confirmStyles.cancelButton} onPress={() => setShowEndConfirm(false)}>
                <ThemedText type="body" style={confirmStyles.cancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={confirmStyles.confirmButton} onPress={confirmEndMatch}>
                <ThemedText type="body" style={confirmStyles.confirmText}>Yes, End Game</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface ActionSheetProps {
  visible: boolean;
  action: ActionType | null;
  players: Player[];
  substitutes: Player[];
  selectedPlayer: Player | null;
  onClose: () => void;
  onGoalFor: (scorer: Player, goalType: GoalType, assist?: Player) => void;
  onGoalAgainst: (goalType: GoalType) => void;
  onCard: (player: Player, cardType: CardType) => void;
  onSubstitution: (playerOff: Player, playerOn: Player) => void;
  onPenalty: (isFor: boolean, outcome?: "scored" | "saved", scorerId?: string) => void;
}

function ActionSheet({
  visible,
  action,
  players,
  substitutes,
  selectedPlayer,
  onClose,
  onGoalFor,
  onGoalAgainst,
  onCard,
  onSubstitution,
  onPenalty,
}: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [scorer, setScorer] = useState<Player | null>(null);
  const [assist, setAssist] = useState<Player | null>(null);
  const [goalType, setGoalType] = useState<GoalType>("open_play");
  const [cardType, setCardType] = useState<CardType>("yellow");
  const [playerOff, setPlayerOff] = useState<Player | null>(null);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setScorer(selectedPlayer);
      setAssist(null);
      setGoalType("open_play");
      setCardType("yellow");
      setPlayerOff(null);
    }
  }, [visible, selectedPlayer]);

  const renderPlayerGrid = (
    playerList: Player[],
    selected: Player | null,
    onSelect: (p: Player) => void,
    allowNone?: boolean
  ) => (
    <View style={sheetStyles.playerGrid}>
      {allowNone ? (
        <Pressable
          style={[sheetStyles.playerOption, !selected && sheetStyles.playerOptionSelected]}
          onPress={() => { Haptics.selectionAsync(); onSelect(null as any); }}
        >
          <ThemedText type="body" style={sheetStyles.playerOptionText}>-</ThemedText>
          <ThemedText type="small" style={{ color: AppColors.textSecondary }}>None</ThemedText>
        </Pressable>
      ) : null}
      {playerList.map((item) => (
        <Pressable
          key={item.id}
          style={[sheetStyles.playerOption, selected?.id === item.id && sheetStyles.playerOptionSelected]}
          onPress={() => { Haptics.selectionAsync(); onSelect(item); }}
        >
          <ThemedText type="body" style={sheetStyles.playerOptionText}>{getPlayerDisplayName(item)}</ThemedText>
          <ThemedText type="small" numberOfLines={1} style={{ color: AppColors.textSecondary }}>{item.name}</ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderContent = () => {
    if (action === "goal_for") {
      if (step === 0) {
        return (
          <ScrollView style={sheetStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <ThemedText type="h4" style={sheetStyles.title}>Who scored?</ThemedText>
            {renderPlayerGrid(players, scorer, setScorer)}
            <Pressable
              style={[sheetStyles.confirmButton, !scorer && sheetStyles.confirmButtonDisabled]}
              onPress={() => scorer && setStep(1)}
              disabled={!scorer}
            >
              <ThemedText type="body" style={sheetStyles.confirmButtonText}>Next</ThemedText>
            </Pressable>
          </ScrollView>
        );
      } else if (step === 1) {
        return (
          <ScrollView style={sheetStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <ThemedText type="h4" style={sheetStyles.title}>Who assisted?</ThemedText>
            {renderPlayerGrid(players.filter(p => p.id !== scorer?.id), assist, setAssist, true)}
            <Pressable style={sheetStyles.confirmButton} onPress={() => setStep(2)}>
              <ThemedText type="body" style={sheetStyles.confirmButtonText}>{assist ? "Next" : "Skip"}</ThemedText>
            </Pressable>
          </ScrollView>
        );
      } else {
        return (
          <View style={sheetStyles.content}>
            <ThemedText type="h4" style={sheetStyles.title}>Goal type</ThemedText>
            <View style={sheetStyles.optionsRow}>
              {(["open_play", "corner", "free_kick"] as GoalType[]).map((type) => (
                <Pressable
                  key={type}
                  style={[sheetStyles.typeOption, goalType === type && sheetStyles.typeOptionSelected]}
                  onPress={() => { Haptics.selectionAsync(); setGoalType(type); }}
                >
                  <ThemedText type="small" style={[sheetStyles.typeOptionText, goalType === type && sheetStyles.typeOptionTextSelected]}>
                    {type.replace("_", " ")}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable style={sheetStyles.confirmButton} onPress={() => scorer && onGoalFor(scorer, goalType, assist || undefined)}>
              <ThemedText type="body" style={sheetStyles.confirmButtonText}>Confirm Goal</ThemedText>
            </Pressable>
          </View>
        );
      }
    }

    if (action === "goal_against") {
      return (
        <View style={sheetStyles.content}>
          <ThemedText type="h4" style={sheetStyles.title}>Goal conceded type</ThemedText>
          <View style={sheetStyles.optionsRow}>
            {(["open_play", "corner", "free_kick"] as GoalType[]).map((type) => (
              <Pressable
                key={type}
                style={[sheetStyles.typeOption, goalType === type && sheetStyles.typeOptionSelected]}
                onPress={() => { Haptics.selectionAsync(); setGoalType(type); }}
              >
                <ThemedText type="small" style={[sheetStyles.typeOptionText, goalType === type && sheetStyles.typeOptionTextSelected]}>
                  {type.replace("_", " ")}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable style={sheetStyles.confirmButton} onPress={() => onGoalAgainst(goalType)}>
            <ThemedText type="body" style={sheetStyles.confirmButtonText}>Confirm</ThemedText>
          </Pressable>
        </View>
      );
    }

    if (action === "card") {
      if (step === 0) {
        return (
          <ScrollView style={sheetStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <ThemedText type="h4" style={sheetStyles.title}>Who received the card?</ThemedText>
            {renderPlayerGrid(players, scorer, setScorer)}
            <Pressable
              style={[sheetStyles.confirmButton, !scorer && sheetStyles.confirmButtonDisabled]}
              onPress={() => scorer && setStep(1)}
              disabled={!scorer}
            >
              <ThemedText type="body" style={sheetStyles.confirmButtonText}>Next</ThemedText>
            </Pressable>
          </ScrollView>
        );
      } else {
        return (
          <View style={sheetStyles.content}>
            <ThemedText type="h4" style={sheetStyles.title}>Card type</ThemedText>
            <View style={sheetStyles.optionsRow}>
              <Pressable
                style={[sheetStyles.cardOption, { backgroundColor: AppColors.warningYellow }, cardType === "yellow" && sheetStyles.cardOptionSelected]}
                onPress={() => { Haptics.selectionAsync(); setCardType("yellow"); }}
              >
                <ThemedText type="body" style={{ color: "#000" }}>Yellow</ThemedText>
              </Pressable>
              <Pressable
                style={[sheetStyles.cardOption, { backgroundColor: AppColors.redCard }, cardType === "red" && sheetStyles.cardOptionSelected]}
                onPress={() => { Haptics.selectionAsync(); setCardType("red"); }}
              >
                <ThemedText type="body" style={{ color: "#FFF" }}>Red</ThemedText>
              </Pressable>
            </View>
            <Pressable style={sheetStyles.confirmButton} onPress={() => scorer && onCard(scorer, cardType)}>
              <ThemedText type="body" style={sheetStyles.confirmButtonText}>Confirm</ThemedText>
            </Pressable>
          </View>
        );
      }
    }

    if (action === "sub") {
      if (step === 0) {
        return (
          <ScrollView style={sheetStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <ThemedText type="h4" style={sheetStyles.title}>Player coming off</ThemedText>
            {renderPlayerGrid(players, playerOff, setPlayerOff)}
            <Pressable
              style={[sheetStyles.confirmButton, !playerOff && sheetStyles.confirmButtonDisabled]}
              onPress={() => playerOff && setStep(1)}
              disabled={!playerOff}
            >
              <ThemedText type="body" style={sheetStyles.confirmButtonText}>Next</ThemedText>
            </Pressable>
          </ScrollView>
        );
      } else {
        return (
          <ScrollView style={sheetStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <ThemedText type="h4" style={sheetStyles.title}>Player coming on</ThemedText>
            {substitutes.length > 0 ? (
              renderPlayerGrid(substitutes, scorer, setScorer)
            ) : (
              <ThemedText type="body" style={{ color: AppColors.textSecondary, textAlign: "center", padding: Spacing.xl }}>
                No substitutes available
              </ThemedText>
            )}
            <Pressable
              style={[sheetStyles.confirmButton, !scorer && sheetStyles.confirmButtonDisabled]}
              onPress={() => playerOff && scorer && onSubstitution(playerOff, scorer)}
              disabled={!scorer}
            >
              <ThemedText type="body" style={sheetStyles.confirmButtonText}>Confirm Sub</ThemedText>
            </Pressable>
          </ScrollView>
        );
      }
    }

    if (action === "penalty") {
      if (step === 0) {
        return (
          <View style={sheetStyles.content}>
            <ThemedText type="h4" style={sheetStyles.title}>Penalty</ThemedText>
            <View style={sheetStyles.penaltyOptions}>
              <Pressable style={sheetStyles.penaltyButton} onPress={() => setStep(1)}>
                <Feather name="check-circle" size={24} color={AppColors.pitchGreen} />
                <ThemedText type="body">For Us - Scored</ThemedText>
              </Pressable>
              <Pressable style={sheetStyles.penaltyButton} onPress={() => onPenalty(true, "saved")}>
                <Feather name="x-circle" size={24} color={AppColors.redCard} />
                <ThemedText type="body">For Us - Saved</ThemedText>
              </Pressable>
              <Pressable style={sheetStyles.penaltyButton} onPress={() => onPenalty(false, "scored")}>
                <Feather name="check-circle" size={24} color={AppColors.redCard} />
                <ThemedText type="body">Against Us - Scored</ThemedText>
              </Pressable>
              <Pressable style={sheetStyles.penaltyButton} onPress={() => onPenalty(false, "saved")}>
                <Feather name="x-circle" size={24} color={AppColors.pitchGreen} />
                <ThemedText type="body">Against Us - Saved</ThemedText>
              </Pressable>
            </View>
          </View>
        );
      } else {
        return (
          <ScrollView style={sheetStyles.scrollContent} showsVerticalScrollIndicator={false}>
            <ThemedText type="h4" style={sheetStyles.title}>Who scored the penalty?</ThemedText>
            {renderPlayerGrid(players, scorer, setScorer)}
            <Pressable
              style={[sheetStyles.confirmButton, !scorer && sheetStyles.confirmButtonDisabled]}
              onPress={() => scorer && onPenalty(true, "scored", scorer.id)}
              disabled={!scorer}
            >
              <ThemedText type="body" style={sheetStyles.confirmButtonText}>Confirm</ThemedText>
            </Pressable>
          </ScrollView>
        );
      }
    }

    return null;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.overlay} onPress={onClose}><View /></Pressable>
      <View style={[sheetStyles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={sheetStyles.handle} />
        <Pressable style={sheetStyles.closeButton} onPress={onClose}>
          <Feather name="x" size={24} color={AppColors.textSecondary} />
        </Pressable>
        {renderContent()}
      </View>
    </Modal>
  );
}

interface TimelineSheetProps {
  visible: boolean;
  events: MatchEvent[];
  players: Player[];
  onClose: () => void;
  onDeleteEvent?: (eventId: string) => void;
}

function TimelineSheet({ visible, events, players, onClose, onDeleteEvent }: TimelineSheetProps) {
  const insets = useSafeAreaInsets();
  const [hideSubs, setHideSubs] = useState(false);

  const filteredEvents = hideSubs ? events.filter(e => e.type !== "substitution") : events;

  const getPlayerName = (id?: string) => {
    if (!id) return "";
    const player = players.find((p) => p.id === id);
    return player?.name || "Unknown";
  };

  const formatGoalType = (goalType?: GoalType) => {
    if (!goalType) return "";
    return goalType.replace("_", " ");
  };

  const getEventIcon = (event: MatchEvent) => {
    switch (event.type) {
      case "goal_for":
        return <Feather name="target" size={16} color={AppColors.pitchGreen} />;
      case "goal_against":
        return <Feather name="target" size={16} color={AppColors.redCard} />;
      case "card":
        return (
          <View style={{ width: 12, height: 16, backgroundColor: event.cardType === "yellow" ? AppColors.warningYellow : AppColors.redCard, borderRadius: 2 }} />
        );
      case "substitution":
        return <Feather name="refresh-cw" size={16} color={AppColors.textSecondary} />;
      case "penalty":
        return <Feather name="circle" size={16} color={AppColors.warningYellow} />;
      default:
        return null;
    }
  };

  const getEventText = (event: MatchEvent) => {
    switch (event.type) {
      case "goal_for":
        const assistText = event.assistPlayerId ? ` (assist: ${getPlayerName(event.assistPlayerId)})` : "";
        const goalTypeText = event.goalType ? ` - ${formatGoalType(event.goalType)}` : "";
        return `Goal: ${getPlayerName(event.playerId)}${assistText}${goalTypeText}`;
      case "goal_against":
        return `Goal conceded (${formatGoalType(event.goalType)})`;
      case "card":
        return `${event.cardType === "yellow" ? "Yellow" : "Red"} card: ${getPlayerName(event.playerId)}`;
      case "substitution":
        return `Sub: ${getPlayerName(event.playerOnId)} on for ${getPlayerName(event.playerOffId)}`;
      case "penalty":
        return `Penalty ${event.isForTeam ? "for" : "against"}: ${event.penaltyOutcome}`;
      default:
        return "";
    }
  };

  const handleDeleteEvent = useCallback((eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDeleteEvent?.(eventId);
  }, [onDeleteEvent]);

  const renderRightActions = useCallback((eventId: string) => {
    return (
      <Pressable
        style={sheetStyles.deleteEventAction}
        onPress={() => handleDeleteEvent(eventId)}
      >
        <Feather name="trash-2" size={18} color="#FFFFFF" />
      </Pressable>
    );
  }, [handleDeleteEvent]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.overlay} onPress={onClose}><View /></Pressable>
      <View style={[sheetStyles.sheet, sheetStyles.timelineSheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={sheetStyles.handle} />
        <Pressable style={sheetStyles.closeButton} onPress={onClose}>
          <Feather name="x" size={24} color={AppColors.textSecondary} />
        </Pressable>
        <ThemedText type="h4" style={sheetStyles.title}>Match Timeline</ThemedText>
        <Pressable style={sheetStyles.filterToggle} onPress={() => setHideSubs(!hideSubs)}>
          <Feather name={hideSubs ? "check-square" : "square"} size={18} color={AppColors.textSecondary} />
          <ThemedText type="small" style={{ color: AppColors.textSecondary }}>Hide substitutions</ThemedText>
        </Pressable>
        {onDeleteEvent ? (
          <ThemedText type="caption" style={{ color: AppColors.textSecondary, marginBottom: Spacing.sm }}>
            Swipe left on an event to remove it
          </ThemedText>
        ) : null}
        {filteredEvents.length === 0 ? (
          <View style={sheetStyles.emptyTimeline}>
            <Feather name="clock" size={32} color={AppColors.textSecondary} />
            <ThemedText type="body" style={{ color: AppColors.textSecondary }}>No events yet</ThemedText>
          </View>
        ) : (
          <FlatList
            data={[...filteredEvents].reverse()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              onDeleteEvent ? (
                <Swipeable
                  renderRightActions={() => renderRightActions(item.id)}
                  overshootRight={false}
                  friction={2}
                >
                  <View style={sheetStyles.timelineItem}>
                    <ThemedText type="small" style={sheetStyles.timelineTime}>{formatMatchTime(item.timestamp)}</ThemedText>
                    {getEventIcon(item)}
                    <ThemedText type="small" style={sheetStyles.timelineText}>{getEventText(item)}</ThemedText>
                  </View>
                </Swipeable>
              ) : (
                <View style={sheetStyles.timelineItem}>
                  <ThemedText type="small" style={sheetStyles.timelineTime}>{formatMatchTime(item.timestamp)}</ThemedText>
                  {getEventIcon(item)}
                  <ThemedText type="small" style={sheetStyles.timelineText}>{getEventText(item)}</ThemedText>
                </View>
              )
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  topBarLeft: { width: 40 },
  topBarRight: { width: 40, alignItems: "flex-end" },
  scoreSection: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  scoreText: { color: "#FFFFFF", minWidth: 50, textAlign: "center" },
  scoreDivider: { color: AppColors.textSecondary, marginHorizontal: Spacing.md },
  clockSection: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.md, marginBottom: Spacing.xs },
  timeDisplay: { flexDirection: "row", alignItems: "baseline", gap: Spacing.xs },
  clockText: { color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  addedTimeText: { color: AppColors.pitchGreen, fontWeight: "700" },
  clockButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: AppColors.pitchGreen, justifyContent: "center", alignItems: "center" },
  halfTimeIndicator: { alignItems: "center", marginBottom: Spacing.xs },
  halfTimeText: { color: AppColors.warningYellow, fontWeight: "700" },
  periodIndicator: { alignItems: "center", marginBottom: Spacing.xs },
  teamsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.sm },
  teamLabel: { color: AppColors.textSecondary, maxWidth: 120 },
  vsLabel: { color: AppColors.textDisabled },
  middleZone: { flex: 1, paddingHorizontal: Spacing.md },
  pitchContainer: { flex: 1, justifyContent: "center" },
  pitch: { width: "100%", aspectRatio: 1.5, backgroundColor: "#1a472a", borderRadius: BorderRadius.md, borderWidth: 2, borderColor: "#2a6a3a", position: "relative", overflow: "hidden" },
  pitchCenterCircle: { position: "absolute", width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", left: "50%", top: "50%", marginLeft: -30, marginTop: -30 },
  pitchCenterLine: { position: "absolute", width: 2, height: "100%", backgroundColor: "rgba(255,255,255,0.3)", left: "50%", marginLeft: -1 },
  pitchGoalAreaTop: { position: "absolute", width: 80, height: 30, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopWidth: 0, left: "50%", marginLeft: -40, top: 0 },
  pitchGoalAreaBottom: { position: "absolute", width: 80, height: 30, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderBottomWidth: 0, left: "50%", marginLeft: -40, bottom: 0 },
  playersGrid: { position: "absolute", width: "100%", height: "100%" },
  playerCircle: { position: "absolute", width: 50, height: 50, borderRadius: 25, backgroundColor: AppColors.pitchGreen, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  draggablePlayerCircle: { position: "absolute", width: 50, height: 50, borderRadius: 25, backgroundColor: AppColors.pitchGreen, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  playerCircleText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  benchContainer: { paddingVertical: Spacing.sm },
  benchLabel: { color: AppColors.textSecondary, marginBottom: Spacing.xs },
  benchList: { gap: Spacing.sm },
  benchPlayer: { backgroundColor: AppColors.elevated, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.xs },
  benchPlayerText: { color: AppColors.textSecondary },
  bottomBar: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.sm },
  actionButtonsRow: { flexDirection: "row", gap: Spacing.sm },
  actionButton: { flex: 1, height: Spacing.actionButtonHeight, borderRadius: BorderRadius.xs, justifyContent: "center", alignItems: "center" },
  actionButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  goalButton: { backgroundColor: AppColors.pitchGreen },
  goalAgainstButton: { backgroundColor: "#4a4a4a" },
  cardButton: { backgroundColor: AppColors.warningYellow },
  subButton: { backgroundColor: "#3a5a8a" },
  halfTimeButton: { backgroundColor: "#f57c00" },
  penaltyButton: { backgroundColor: "#6a4a8a" },
  endButton: { backgroundColor: AppColors.redCard },
});

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: AppColors.surface, borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, paddingTop: Spacing.md, paddingHorizontal: Spacing.lg, maxHeight: SCREEN_HEIGHT * 0.7 },
  timelineSheet: { maxHeight: SCREEN_HEIGHT * 0.5 },
  handle: { width: 40, height: 4, backgroundColor: AppColors.textDisabled, borderRadius: 2, alignSelf: "center", marginBottom: Spacing.md },
  closeButton: { position: "absolute", top: Spacing.md, right: Spacing.md, padding: Spacing.sm, zIndex: 10 },
  content: { paddingTop: Spacing.md },
  scrollContent: { maxHeight: SCREEN_HEIGHT * 0.5 },
  title: { textAlign: "center", marginBottom: Spacing.lg },
  playerGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  playerOption: { width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 2) / 3, padding: Spacing.md, backgroundColor: AppColors.elevated, borderRadius: BorderRadius.sm, alignItems: "center" },
  playerOptionSelected: { backgroundColor: AppColors.pitchGreen },
  playerOptionText: { fontWeight: "600", marginBottom: 2 },
  optionsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.xl },
  typeOption: { flex: 1, paddingVertical: Spacing.md, backgroundColor: AppColors.elevated, borderRadius: BorderRadius.sm, alignItems: "center" },
  typeOptionSelected: { backgroundColor: AppColors.pitchGreen },
  typeOptionText: { color: AppColors.textSecondary, textTransform: "capitalize" },
  typeOptionTextSelected: { color: "#FFFFFF", fontWeight: "600" },
  cardOption: { flex: 1, paddingVertical: Spacing.lg, borderRadius: BorderRadius.sm, alignItems: "center" },
  cardOptionSelected: { borderWidth: 3, borderColor: "#FFFFFF" },
  confirmButton: { backgroundColor: AppColors.pitchGreen, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.md },
  confirmButtonDisabled: { backgroundColor: AppColors.textDisabled },
  confirmButtonText: { color: "#FFFFFF" },
  penaltyOptions: { gap: Spacing.md },
  penaltyButton: { flexDirection: "row", alignItems: "center", gap: Spacing.md, backgroundColor: AppColors.elevated, padding: Spacing.lg, borderRadius: BorderRadius.sm },
  emptyTimeline: { alignItems: "center", paddingVertical: Spacing["3xl"], gap: Spacing.md },
  timelineItem: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: AppColors.elevated, backgroundColor: AppColors.surface },
  deleteEventAction: { width: 60, height: "100%", backgroundColor: AppColors.redCard, justifyContent: "center", alignItems: "center" },
  timelineTime: { color: AppColors.textSecondary, width: 50 },
  timelineText: { flex: 1 },
  filterToggle: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm, marginBottom: Spacing.sm },
});

const confirmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: Spacing.xl },
  dialog: { backgroundColor: AppColors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, width: "100%", maxWidth: 320 },
  title: { textAlign: "center", marginBottom: Spacing.md },
  message: { textAlign: "center", color: AppColors.textSecondary, marginBottom: Spacing.xl },
  buttons: { flexDirection: "row", gap: Spacing.md },
  cancelButton: { flex: 1, paddingVertical: Spacing.md, backgroundColor: AppColors.elevated, borderRadius: BorderRadius.sm, alignItems: "center" },
  cancelText: { color: AppColors.textSecondary },
  confirmButton: { flex: 1, paddingVertical: Spacing.md, backgroundColor: AppColors.redCard, borderRadius: BorderRadius.sm, alignItems: "center" },
  confirmText: { color: "#FFFFFF" },
});
