import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
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
type TabType = "events" | "formation" | "notes";

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
  const [, setTick] = useState(0);
  
  useEffect(() => {
    if (isRunning) {
      const id = setInterval(() => {
        setTick(prev => prev + 1);
      }, 1000);
      return () => clearInterval(id);
    }
  }, [isRunning, startTimestampProp]);
  
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
  disabled?: boolean;
  compact?: boolean;
}

function DraggablePlayer({ player, position, pitchDimensions, onPositionChange, onTap, disabled = false, compact = false }: DraggablePlayerProps) {
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
    .enabled(!disabled)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      scale.value = withSpring(1.2);
      runOnJS(Haptics.selectionAsync)();
    })
    .onUpdate((event) => {
      const newX = startX.value + event.translationX;
      const newY = startY.value + event.translationY;
      const playerSize = compact ? 28 : 50;
      translateX.value = Math.max(0, Math.min(pitchDimensions.width - playerSize, newX));
      translateY.value = Math.max(0, Math.min(pitchDimensions.height - playerSize, newY));
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      runOnJS(onPositionChange)(player.id, translateX.value, translateY.value);
    });

  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onEnd(() => {
      runOnJS(Haptics.selectionAsync)();
      runOnJS(onTap)();
    });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const playerCircleStyle = compact ? styles.compactPlayerCircle : styles.draggablePlayerCircle;
  const playerTextStyle = compact ? styles.compactPlayerText : styles.playerCircleText;

  if (disabled) {
    return (
      <Animated.View style={[playerCircleStyle, animatedStyle]}>
        <ThemedText type="small" style={playerTextStyle}>
          {getPlayerDisplayName(player)}
        </ThemedText>
      </Animated.View>
    );
  }

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[playerCircleStyle, animatedStyle]}>
        <ThemedText type="small" style={playerTextStyle}>
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
  const [baseTime, setBaseTime] = useState(0);
  const [timerStartTimestamp, setTimerStartTimestamp] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("events");
  
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionType | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showSecondYellowConfirm, setShowSecondYellowConfirm] = useState(false);
  const [pendingSecondYellowPlayer, setPendingSecondYellowPlayer] = useState<Player | null>(null);
  const [isHalfTime, setIsHalfTime] = useState(false);
  const [isSecondHalf, setIsSecondHalf] = useState(false);
  const [firstHalfAddedTime, setFirstHalfAddedTime] = useState(0);
  const [secondHalfAddedTime, setSecondHalfAddedTime] = useState(0);
  const [playerPositions, setPlayerPositions] = useState<PlayerPosition[]>([]);
  const [pitchDimensions, setPitchDimensions] = useState({ width: 0, height: 0 });
  const [compactPitchDimensions, setCompactPitchDimensions] = useState({ width: 0, height: 0 });
  const [isFormationExpanded, setIsFormationExpanded] = useState(false);
  const [notesText, setNotesText] = useState("");
  const [showNotesPopout, setShowNotesPopout] = useState(false);

  const lastSaveRef = useRef<number>(0);
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const matchData = await getMatch(route.params.matchId);
      if (matchData) {
        setMatch(matchData);
        setNotesText(matchData.notes || "");
        setIsHalfTime(matchData.isHalfTime || false);
        setIsSecondHalf(matchData.halfTimeTriggered || false);
        setFirstHalfAddedTime(matchData.firstHalfAddedTime || 0);
        setSecondHalfAddedTime(matchData.secondHalfAddedTime || 0);
        
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

  const getCurrentMatchTime = useCallback(() => {
    if (!isRunning || !timerStartTimestamp) {
      return baseTime;
    }
    const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000);
    return baseTime + elapsed;
  }, [isRunning, timerStartTimestamp, baseTime]);

  useEffect(() => {
    const now = Date.now();
    if (match && !match.isCompleted && now - lastSaveRef.current > 5000) {
      lastSaveRef.current = now;
      let currentTime = baseTime;
      if (isRunning && timerStartTimestamp) {
        currentTime = baseTime + Math.floor((Date.now() - timerStartTimestamp) / 1000);
      }
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
  }, [baseTime, timerStartTimestamp, match, isHalfTime, isSecondHalf, firstHalfAddedTime, secondHalfAddedTime, isRunning]);

  const plannedDuration = (match?.plannedDuration || 60) * 60;
  const halfDuration = plannedDuration / 2;

  const handleToggleClock = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isHalfTime) {
      const currentTime = getCurrentMatchTime();
      setIsHalfTime(false);
      setIsSecondHalf(true);
      setFirstHalfAddedTime(currentTime > halfDuration ? currentTime - halfDuration : 0);
    }
    
    if (!isRunning) {
      const now = Date.now();
      setTimerStartTimestamp(now);
      setIsRunning(true);
      
      if (baseTime === 0 && match && !match.kickoffTimestamp) {
        const updatedMatch = { ...match, kickoffTimestamp: now };
        setMatch(updatedMatch);
        await saveMatch(updatedMatch);
      }
    } else {
      if (timerStartTimestamp) {
        const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000);
        setBaseTime(prev => prev + elapsed);
      }
      setTimerStartTimestamp(null);
      setIsRunning(false);
    }
  }, [isHalfTime, isRunning, timerStartTimestamp, getCurrentMatchTime, halfDuration, baseTime, match]);

  const handleHalfTimeOrEnd = useCallback(async () => {
    const currentTime = getCurrentMatchTime();
    
    if (isSecondHalf) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowEndConfirm(true);
      return;
    }
    
    if (isHalfTime) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsHalfTime(false);
      setIsSecondHalf(true);
      if (currentTime > halfDuration) {
        setFirstHalfAddedTime(currentTime - halfDuration);
      }
      setTimerStartTimestamp(Date.now());
      setIsRunning(true);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (timerStartTimestamp) {
        const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000);
        setBaseTime(prev => prev + elapsed);
      }
      setTimerStartTimestamp(null);
      setIsRunning(false);
      setIsHalfTime(true);
      
      const htAddedTime = currentTime > halfDuration ? currentTime - halfDuration : 0;
      setFirstHalfAddedTime(htAddedTime);
      
      if (match) {
        const updatedMatch = { ...match, halfTimeMatchTime: currentTime };
        setMatch(updatedMatch);
        await saveMatch(updatedMatch);
      }
    }
  }, [isHalfTime, isSecondHalf, getCurrentMatchTime, halfDuration, timerStartTimestamp, match]);

  const handlePauseLongPress = useCallback(() => {
    if (isRunning) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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

  const getSentOffPlayerIds = useCallback(() => {
    if (!match) return new Set<string>();
    const sentOffIds = new Set<string>();
    
    match.events
      .filter((e) => e.type === "card" && (e.cardType === "red" || e.cardType === "second_yellow") && e.playerId)
      .forEach((e) => {
        if (e.playerId) sentOffIds.add(e.playerId);
      });
    
    return sentOffIds;
  }, [match]);

  const getPlayerYellowCardCount = useCallback((playerId: string) => {
    if (!match) return 0;
    return match.events.filter(
      (e) => e.type === "card" && e.cardType === "yellow" && e.playerId === playerId
    ).length;
  }, [match]);

  const getPlayersOnPitch = useCallback(() => {
    if (!team || !match) return [];
    const onPitchIds = new Set(match.startingLineup);
    const sentOffIds = getSentOffPlayerIds();

    match.events
      .filter((e) => e.type === "substitution")
      .forEach((e) => {
        if (e.playerOffId) onPitchIds.delete(e.playerOffId);
        if (e.playerOnId) onPitchIds.add(e.playerOnId);
      });

    return team.players.filter((p) => onPitchIds.has(p.id) && !sentOffIds.has(p.id));
  }, [team, match, getSentOffPlayerIds]);

  const getSubstitutes = useCallback(() => {
    if (!team || !match) return [];
    const onPitchIds = new Set(match.startingLineup);
    const sentOffIds = getSentOffPlayerIds();

    match.events
      .filter((e) => e.type === "substitution")
      .forEach((e) => {
        if (e.playerOffId) onPitchIds.delete(e.playerOffId);
        if (e.playerOnId) onPitchIds.add(e.playerOnId);
      });

    const availablePlayerIds = new Set([...match.substitutes, ...match.startingLineup]);
    return team.players.filter(
      (p) => !onPitchIds.has(p.id) && availablePlayerIds.has(p.id) && !sentOffIds.has(p.id)
    );
  }, [team, match, getSentOffPlayerIds]);

  const getSentOffPlayers = useCallback(() => {
    if (!team || !match) return [];
    const sentOffIds = getSentOffPlayerIds();
    return team.players.filter((p) => sentOffIds.has(p.id));
  }, [team, match, getSentOffPlayerIds]);

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
      } else if (event.type === "penalty" && event.penaltyOutcome === "scored") {
        if (event.isForTeam) {
          scoreFor += 1;
        } else {
          scoreAgainst += 1;
        }
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

  const handleNotesChange = useCallback((text: string) => {
    setNotesText(text);
    
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }
    
    notesTimeoutRef.current = setTimeout(async () => {
      if (match) {
        const updatedMatch = { ...match, notes: text };
        setMatch(updatedMatch);
        await saveMatch(updatedMatch);
      }
    }, 500);
  }, [match]);

  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, []);

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
      if (cardType === "yellow") {
        const yellowCount = getPlayerYellowCardCount(player.id);
        if (yellowCount >= 1) {
          setPendingSecondYellowPlayer(player);
          setShowActionSheet(false);
          setShowSecondYellowConfirm(true);
          return;
        }
      }
      
      await addEvent({
        type: "card",
        playerId: player.id,
        cardType,
      });
      setShowActionSheet(false);
    },
    [addEvent, getPlayerYellowCardCount]
  );

  const confirmSecondYellow = useCallback(async () => {
    if (!pendingSecondYellowPlayer || !match) return;
    
    const currentTime = getCurrentMatchTime();
    
    const secondYellowEvent: MatchEvent = {
      id: generateId(),
      type: "card",
      timestamp: currentTime,
      playerId: pendingSecondYellowPlayer.id,
      cardType: "second_yellow",
    };
    
    const updatedMatch = {
      ...match,
      events: [...match.events, secondYellowEvent],
      totalMatchTime: currentTime,
    };
    
    setMatch(updatedMatch);
    await saveMatch(updatedMatch);
    
    setPendingSecondYellowPlayer(null);
    setShowSecondYellowConfirm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [pendingSecondYellowPlayer, match, getCurrentMatchTime]);

  const cancelSecondYellow = useCallback(() => {
    setPendingSecondYellowPlayer(null);
    setShowSecondYellowConfirm(false);
  }, []);

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
    async (isFor: boolean, outcome?: "scored" | "saved" | "missed", scorerId?: string) => {
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

  const confirmEndMatch = useCallback(async () => {
    if (!match || !team) return;
    
    const currentTime = getCurrentMatchTime();
    
    setShowEndConfirm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const result =
      match.scoreFor > match.scoreAgainst
        ? "win"
        : match.scoreFor < match.scoreAgainst
          ? "loss"
          : "draw";

    const updatedMatch: Match = {
      ...match,
      isCompleted: true,
      totalMatchTime: currentTime,
      endMatchTime: currentTime,
      halfTimeTriggered: isSecondHalf,
      firstHalfAddedTime: firstHalfAddedTime,
      secondHalfAddedTime: secondHalfAddedTime,
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
      setMatch(updatedMatch);
      await saveMatch(updatedMatch);
      await saveTeam(updatedTeam);
      setIsRunning(false);
      setTimerStartTimestamp(null);
      navigation.replace("MatchSummary", { matchId: match.id });
    } catch (error) {
      console.error("Error ending match:", error);
    }
  }, [match, team, getCurrentMatchTime, navigation, isSecondHalf, firstHalfAddedTime, secondHalfAddedTime]);

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

  const playersOnPitch = useMemo(() => getPlayersOnPitch(), [getPlayersOnPitch]);
  const substitutes = useMemo(() => getSubstitutes(), [getSubstitutes]);
  const sentOffPlayers = useMemo(() => getSentOffPlayers(), [getSentOffPlayers]);

  const getFormationPositions = useCallback((format: string, playerCount: number): { x: number; y: number }[] => {
    const formations: Record<string, number[]> = {
      "5v5": [1, 2, 2],
      "7v7": [1, 2, 3, 1],
      "9v9": [1, 3, 3, 2],
      "11v11": [1, 4, 4, 2],
    };
    
    const formation = formations[format] || formations["11v11"];
    const positions: { x: number; y: number }[] = [];
    
    let playerIndex = 0;
    const totalRows = formation.length;
    
    for (let rowIdx = 0; rowIdx < totalRows && playerIndex < playerCount; rowIdx++) {
      const playersInRow = formation[rowIdx];
      const yPos = 0.85 - (rowIdx / (totalRows - 1 || 1)) * 0.7;
      
      for (let colIdx = 0; colIdx < playersInRow && playerIndex < playerCount; colIdx++) {
        const xPos = playersInRow === 1 
          ? 0.5 
          : 0.15 + (colIdx / (playersInRow - 1)) * 0.7;
        
        positions.push({ x: xPos, y: yPos });
        playerIndex++;
      }
    }
    
    while (playerIndex < playerCount) {
      const row = Math.floor((playerIndex - positions.length) / 4);
      const col = (playerIndex - positions.length) % 4;
      positions.push({
        x: 0.15 + col * 0.23,
        y: 0.15 + row * 0.28,
      });
      playerIndex++;
    }
    
    return positions;
  }, []);

  useEffect(() => {
    if (playersOnPitch.length > 0 && pitchDimensions.width > 0 && match) {
      setPlayerPositions((prev) => {
        if (prev.length === 0) {
          const formationPositions = getFormationPositions(match.format, playersOnPitch.length);
          return playersOnPitch.map((player, idx) => ({
            playerId: player.id,
            x: (formationPositions[idx]?.x || 0.5) * pitchDimensions.width - 25,
            y: (formationPositions[idx]?.y || 0.5) * pitchDimensions.height - 25,
          }));
        }
        
        const existingIds = new Set(prev.map(p => p.playerId));
        const currentIds = new Set(playersOnPitch.map(p => p.id));
        
        const filtered = prev.filter(p => currentIds.has(p.playerId));
        
        const newPlayers = playersOnPitch.filter(p => !existingIds.has(p.id));
        const formationPositions = getFormationPositions(match.format, playersOnPitch.length);
        
        const newPositions = newPlayers.map((player, idx) => {
          const posIdx = filtered.length + idx;
          return {
            playerId: player.id,
            x: (formationPositions[posIdx]?.x || 0.5) * pitchDimensions.width - 25,
            y: (formationPositions[posIdx]?.y || 0.5) * pitchDimensions.height - 25,
          };
        });
        
        return [...filtered, ...newPositions];
      });
    }
  }, [playersOnPitch, pitchDimensions, match, getFormationPositions]);

  const updatePlayerPosition = useCallback((playerId: string, x: number, y: number) => {
    setPlayerPositions((prev) => 
      prev.map(p => p.playerId === playerId ? { ...p, x, y } : p)
    );
  }, []);

  const handlePitchLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPitchDimensions({ width, height });
  }, []);

  const getPlayerName = (id?: string) => {
    if (!id || !team) return "";
    const player = team.players.find((p) => p.id === id);
    return player?.name || "Unknown";
  };

  const formatGoalType = (goalType?: GoalType) => {
    if (!goalType) return "";
    return goalType.replace("_", " ");
  };

  const formatRealTime = (timestamp: number): string => {
    if (!match?.kickoffTimestamp) return formatMatchTime(timestamp);
    const eventTime = new Date(match.kickoffTimestamp + timestamp * 1000);
    return eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getEventIcon = (event: MatchEvent) => {
    switch (event.type) {
      case "goal_for":
        return <Feather name="target" size={16} color={AppColors.pitchGreen} />;
      case "goal_against":
        return <Feather name="target" size={16} color={AppColors.redCard} />;
      case "card":
        if (event.cardType === "second_yellow") {
          return (
            <View style={{ width: 12, height: 16, borderRadius: 2, overflow: "hidden" }}>
              <View style={{ position: "absolute", width: 0, height: 0, borderStyle: "solid", borderRightWidth: 12, borderBottomWidth: 16, borderRightColor: "transparent", borderBottomColor: AppColors.warningYellow }} />
              <View style={{ position: "absolute", width: 0, height: 0, borderStyle: "solid", borderLeftWidth: 12, borderTopWidth: 16, borderLeftColor: "transparent", borderTopColor: AppColors.redCard }} />
            </View>
          );
        }
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
        if (event.cardType === "second_yellow") {
          return `Second yellow (red): ${getPlayerName(event.playerId)}`;
        }
        return `${event.cardType === "yellow" ? "Yellow" : "Red"} card: ${getPlayerName(event.playerId)}`;
      case "substitution":
        return `Sub: ${getPlayerName(event.playerOnId)} on for ${getPlayerName(event.playerOffId)}`;
      case "penalty":
        const penaltyTeamName = event.isForTeam ? team?.name || "Us" : match?.opposition || "Them";
        return `Penalty ${penaltyTeamName}: ${event.penaltyOutcome}${event.playerId && event.penaltyOutcome === "scored" && event.isForTeam ? ` (${getPlayerName(event.playerId)})` : ""}`;
      default:
        return "";
    }
  };

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

  const getHtButtonText = () => {
    if (isSecondHalf) return "END";
    if (isHalfTime) return "2nd";
    return "HT";
  };

  return (
    <View style={[styles.container, { backgroundColor: AppColors.darkBg }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.teamsHeader}>
          <ThemedText type="body" style={styles.teamName} numberOfLines={1}>
            {team.name}
          </ThemedText>
          <ThemedText type="small" style={styles.vsText}>VS</ThemedText>
          <ThemedText type="body" style={styles.teamName} numberOfLines={1}>
            {match.opposition}
          </ThemedText>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCircle}>
            <ThemedText type="h1" style={styles.scoreNumber}>{match.scoreFor}</ThemedText>
          </View>
          <ThemedText type="h3" style={styles.scoreDash}>-</ThemedText>
          <View style={styles.scoreCircle}>
            <ThemedText type="h1" style={styles.scoreNumber}>{match.scoreAgainst}</ThemedText>
          </View>
        </View>

        <View style={styles.timerRow}>
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
              styles.playPauseButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather
              name={isRunning ? "pause" : "play"}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.htButton,
              isSecondHalf ? styles.endButtonStyle : styles.htButtonStyle,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleHalfTimeOrEnd}
          >
            <ThemedText type="body" style={styles.htButtonText}>
              {getHtButtonText()}
            </ThemedText>
          </Pressable>
        </View>

        {isHalfTime ? (
          <View style={styles.halfTimeIndicator}>
            <ThemedText type="small" style={styles.halfTimeText}>HALF TIME</ThemedText>
          </View>
        ) : (
          <View style={styles.periodIndicator}>
            <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
              {isSecondHalf ? "2nd Half" : "1st Half"}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === "events" && styles.tabActive]}
          onPress={() => { Haptics.selectionAsync(); setActiveTab("events"); }}
        >
          <ThemedText type="body" style={[styles.tabText, activeTab === "events" && styles.tabTextActive]}>
            Events
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "formation" && styles.tabActive]}
          onPress={() => { Haptics.selectionAsync(); setActiveTab("formation"); }}
        >
          <ThemedText type="body" style={[styles.tabText, activeTab === "formation" && styles.tabTextActive]}>
            Formation
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "notes" && styles.tabActive]}
          onPress={() => { 
            Haptics.selectionAsync(); 
            setActiveTab("notes"); 
          }}
        >
          <ThemedText type="body" style={[styles.tabText, activeTab === "notes" && styles.tabTextActive]}>
            Notes
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.tabContent}>
        {activeTab === "events" ? (
          <View style={styles.eventsContainer}>
            {match.events.length === 0 ? (
              <View style={styles.emptyEvents}>
                <Feather name="clock" size={40} color={AppColors.textDisabled} />
                <ThemedText type="body" style={{ color: AppColors.textDisabled, marginTop: Spacing.md }}>
                  No events yet
                </ThemedText>
                <ThemedText type="small" style={{ color: AppColors.textDisabled }}>
                  Use the buttons below to log match events
                </ThemedText>
              </View>
            ) : (
              <FlatList
                data={[...match.events].reverse()}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.eventsList}
                renderItem={({ item }) => (
                  <Swipeable
                    renderRightActions={() => (
                      <Pressable
                        style={styles.deleteEventAction}
                        onPress={() => handleDeleteMatchEvent(item.id)}
                      >
                        <Feather name="trash-2" size={18} color="#FFFFFF" />
                      </Pressable>
                    )}
                    overshootRight={false}
                    friction={2}
                  >
                    <View style={styles.eventItem}>
                      <ThemedText type="body" style={styles.eventTime}>
                        {formatRealTime(item.timestamp)}
                      </ThemedText>
                      <View style={styles.eventIconWrapper}>
                        {getEventIcon(item)}
                      </View>
                      <ThemedText type="small" style={styles.eventText} numberOfLines={2}>
                        {getEventText(item)}
                      </ThemedText>
                    </View>
                  </Swipeable>
                )}
              />
            )}
          </View>
        ) : activeTab === "formation" ? (
          <ScrollView style={styles.formationContainer} contentContainerStyle={styles.formationContent}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsFormationExpanded(!isFormationExpanded);
              }}
            >
              {isFormationExpanded ? (
                <View style={styles.expandedPitchContainer}>
                  <View style={styles.expandedPitch} onLayout={handlePitchLayout}>
                    <View style={styles.pitchPenaltyAreaTop} />
                    <View style={styles.pitchGoalBoxTop} />
                    <View style={styles.pitchCenterCircle} />
                    <View style={styles.pitchCenterLine} />
                    <View style={styles.pitchPenaltyAreaBottom} />
                    <View style={styles.pitchGoalBoxBottom} />

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
                  <ThemedText type="caption" style={styles.tapHint}>
                    Tap to collapse - Drag players to reposition
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.compactPitchContainer}>
                  <View 
                    style={styles.compactPitch} 
                    onLayout={(e) => {
                      const { width, height } = e.nativeEvent.layout;
                      setCompactPitchDimensions({ width, height });
                    }}
                  >
                    <View style={styles.compactCenterCircle} />
                    <View style={styles.compactCenterLine} />
                    <View style={styles.compactGoalAreaLeft} />
                    <View style={styles.compactGoalAreaRight} />

                    <View style={styles.playersGrid}>
                      {playersOnPitch.map((player) => {
                        const pos = playerPositions.find(p => p.playerId === player.id);
                        if (!pos || pitchDimensions.width === 0) return null;
                        const scaleX = compactPitchDimensions.width / pitchDimensions.width;
                        const scaleY = compactPitchDimensions.height / pitchDimensions.height;
                        const rotatedX = (1 - (pos.y + 25) / pitchDimensions.height) * compactPitchDimensions.width - 14;
                        const rotatedY = ((pos.x + 25) / pitchDimensions.width) * compactPitchDimensions.height - 14;
                        return (
                          <DraggablePlayer
                            key={player.id}
                            player={player}
                            position={{ x: rotatedX, y: rotatedY }}
                            pitchDimensions={compactPitchDimensions}
                            onPositionChange={() => {}}
                            onTap={() => {}}
                            disabled={true}
                            compact={true}
                          />
                        );
                      })}
                    </View>
                  </View>
                  <ThemedText type="caption" style={styles.tapHint}>
                    Tap to expand and edit formation
                  </ThemedText>
                </View>
              )}
            </Pressable>

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

            {sentOffPlayers.length > 0 ? (
              <View style={styles.sentOffContainer}>
                <ThemedText type="small" style={styles.sentOffLabel}>
                  SENT OFF
                </ThemedText>
                <FlatList
                  horizontal
                  data={sentOffPlayers}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sentOffList}
                  renderItem={({ item }) => (
                    <View style={styles.sentOffPlayer}>
                      <ThemedText type="small" style={styles.sentOffPlayerText}>
                        {getPlayerDisplayName(item)}
                      </ThemedText>
                    </View>
                  )}
                />
              </View>
            ) : null}
          </ScrollView>
        ) : activeTab === "notes" ? (
          <View style={styles.notesContainer}>
            <Pressable 
              style={styles.notesContentArea}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowNotesPopout(true);
              }}
            >
              {notesText.trim() ? (
                <ScrollView 
                  style={styles.notesScrollView}
                  contentContainerStyle={styles.notesScrollContent}
                  showsVerticalScrollIndicator={true}
                >
                  <ThemedText type="body" style={styles.notesDisplayText}>
                    {notesText}
                  </ThemedText>
                </ScrollView>
              ) : (
                <View style={styles.emptyNotes}>
                  <Feather name="edit-3" size={40} color={AppColors.textDisabled} />
                  <ThemedText type="body" style={{ color: AppColors.textDisabled, marginTop: Spacing.md }}>
                    No notes yet
                  </ThemedText>
                  <ThemedText type="small" style={{ color: AppColors.textDisabled }}>
                    Tap here to add match notes
                  </ThemedText>
                </View>
              )}
            </Pressable>
          </View>
        ) : null}
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
            <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <ThemedText type="body" style={styles.actionButtonText}>
              Goal
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
            <Feather name="minus" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <ThemedText type="body" style={styles.actionButtonText}>
              Goal
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
            <Feather name="circle" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <ThemedText type="body" style={styles.actionButtonText}>
              Penalty
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.actionButtonsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.cardButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => openActionSheet("card")}
          >
            <ThemedText type="body" style={[styles.actionButtonText, { color: "#000" }]}>
              Card
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              styles.subButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => openActionSheet("sub")}
          >
            <Feather name="refresh-cw" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <ThemedText type="body" style={styles.actionButtonText}>
              Sub
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
        homeTeamName={team.name}
        awayTeamName={match.opposition}
        onClose={() => setShowActionSheet(false)}
        onGoalFor={handleGoalFor}
        onGoalAgainst={handleGoalAgainst}
        onCard={handleCard}
        onSubstitution={handleSubstitution}
        onPenalty={handlePenalty}
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

      <Modal visible={showSecondYellowConfirm} transparent animationType="fade" onRequestClose={cancelSecondYellow}>
        <View style={confirmStyles.overlay}>
          <View style={confirmStyles.dialog}>
            <View style={confirmStyles.cardIconsRow}>
              <View style={[confirmStyles.cardIcon, { backgroundColor: AppColors.warningYellow }]} />
              <View style={[confirmStyles.cardIcon, { backgroundColor: AppColors.warningYellow }]} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>=</ThemedText>
              <View style={[confirmStyles.cardIcon, { backgroundColor: AppColors.redCard, marginLeft: Spacing.sm }]} />
            </View>
            <ThemedText type="h4" style={confirmStyles.title}>Second Yellow Card</ThemedText>
            <ThemedText type="body" style={confirmStyles.message}>
              {pendingSecondYellowPlayer?.name} already has a yellow card. A second yellow means a red card and they will be sent off.
            </ThemedText>
            <View style={confirmStyles.buttons}>
              <Pressable style={confirmStyles.cancelButton} onPress={cancelSecondYellow}>
                <ThemedText type="body" style={confirmStyles.cancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={[confirmStyles.confirmButton, { backgroundColor: AppColors.warningYellow }]} onPress={confirmSecondYellow}>
                <ThemedText type="body" style={[confirmStyles.confirmText, { color: "#000" }]}>Confirm Second Yellow</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal 
        visible={showNotesPopout} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setShowNotesPopout(false)}
      >
        <KeyboardAvoidingView 
          style={notesPopoutStyles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable 
            style={notesPopoutStyles.backdrop} 
            onPress={() => setShowNotesPopout(false)} 
          />
          <View style={[notesPopoutStyles.popout, { marginBottom: insets.bottom + Spacing.md }]}>
            <View style={notesPopoutStyles.header}>
              <ThemedText type="h4" style={notesPopoutStyles.title}>Match Notes</ThemedText>
              <Pressable 
                style={notesPopoutStyles.minimizeButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowNotesPopout(false);
                }}
                hitSlop={8}
              >
                <Feather name="minimize-2" size={20} color={AppColors.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              style={notesPopoutStyles.input}
              value={notesText}
              onChangeText={handleNotesChange}
              placeholder="Add notes about the match..."
              placeholderTextColor={AppColors.textSecondary}
              multiline
              textAlignVertical="top"
              autoFocus
            />
            <ThemedText type="caption" style={notesPopoutStyles.hint}>
              Notes are saved automatically
            </ThemedText>
          </View>
        </KeyboardAvoidingView>
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
  homeTeamName: string;
  awayTeamName: string;
  onClose: () => void;
  onGoalFor: (scorer: Player, goalType: GoalType, assist?: Player) => void;
  onGoalAgainst: (goalType: GoalType) => void;
  onCard: (player: Player, cardType: CardType) => void;
  onSubstitution: (playerOff: Player, playerOn: Player) => void;
  onPenalty: (isFor: boolean, outcome?: "scored" | "saved" | "missed", scorerId?: string) => void;
}

function ActionSheet({
  visible,
  action,
  players,
  substitutes,
  selectedPlayer,
  homeTeamName,
  awayTeamName,
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
  const [penaltyForHome, setPenaltyForHome] = useState<boolean | null>(null);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setScorer(selectedPlayer);
      setAssist(null);
      setGoalType("open_play");
      setCardType("yellow");
      setPlayerOff(null);
      setPenaltyForHome(null);
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
            <ThemedText type="body" style={{ textAlign: "center", color: AppColors.textSecondary, marginBottom: Spacing.lg }}>
              Which team was awarded the penalty?
            </ThemedText>
            <View style={sheetStyles.penaltyOptions}>
              <Pressable 
                style={sheetStyles.penaltyTeamButton} 
                onPress={() => { Haptics.selectionAsync(); setPenaltyForHome(true); setStep(1); }}
              >
                <Feather name="shield" size={24} color={AppColors.pitchGreen} />
                <ThemedText type="body" style={sheetStyles.penaltyTeamText}>Penalty {homeTeamName}</ThemedText>
              </Pressable>
              <Pressable 
                style={sheetStyles.penaltyTeamButton} 
                onPress={() => { Haptics.selectionAsync(); setPenaltyForHome(false); setStep(1); }}
              >
                <Feather name="shield" size={24} color={AppColors.redCard} />
                <ThemedText type="body" style={sheetStyles.penaltyTeamText}>Penalty {awayTeamName}</ThemedText>
              </Pressable>
            </View>
          </View>
        );
      } else if (step === 1) {
        const teamName = penaltyForHome ? homeTeamName : awayTeamName;
        const scoredColor = penaltyForHome ? AppColors.pitchGreen : AppColors.redCard;
        const savedColor = penaltyForHome ? AppColors.redCard : AppColors.pitchGreen;
        return (
          <View style={sheetStyles.content}>
            <ThemedText type="h4" style={sheetStyles.title}>Penalty {teamName}</ThemedText>
            <ThemedText type="body" style={{ textAlign: "center", color: AppColors.textSecondary, marginBottom: Spacing.lg }}>
              What was the outcome?
            </ThemedText>
            <View style={sheetStyles.penaltyOptions}>
              <Pressable 
                style={sheetStyles.penaltyButton} 
                onPress={() => { 
                  Haptics.selectionAsync(); 
                  if (penaltyForHome) {
                    setStep(2);
                  } else {
                    onPenalty(false, "scored");
                  }
                }}
              >
                <Feather name="check-circle" size={24} color={scoredColor} />
                <ThemedText type="body">Penalty {teamName} scored</ThemedText>
              </Pressable>
              <Pressable 
                style={sheetStyles.penaltyButton} 
                onPress={() => { Haptics.selectionAsync(); onPenalty(penaltyForHome || false, "saved"); }}
              >
                <Feather name="x-circle" size={24} color={savedColor} />
                <ThemedText type="body">Penalty {teamName} saved</ThemedText>
              </Pressable>
              <Pressable 
                style={sheetStyles.penaltyButton} 
                onPress={() => { Haptics.selectionAsync(); onPenalty(penaltyForHome || false, "missed"); }}
              >
                <Feather name="slash" size={24} color={AppColors.textSecondary} />
                <ThemedText type="body">Penalty {teamName} missed</ThemedText>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  teamsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: Spacing.sm },
  teamName: { color: "#FFFFFF", fontWeight: "600", maxWidth: 120, textAlign: "center" },
  vsText: { color: AppColors.textDisabled, marginHorizontal: Spacing.md, fontSize: 12 },
  
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  scoreCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: AppColors.textSecondary, justifyContent: "center", alignItems: "center" },
  scoreNumber: { color: "#FFFFFF", fontWeight: "700" },
  scoreDash: { color: AppColors.textSecondary, marginHorizontal: Spacing.lg },
  
  timerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.md },
  playPauseButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: AppColors.pitchGreen, justifyContent: "center", alignItems: "center" },
  htButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  htButtonStyle: { backgroundColor: "#f57c00" },
  endButtonStyle: { backgroundColor: AppColors.redCard },
  htButtonText: { color: "#FFFFFF", fontWeight: "700" },
  
  halfTimeIndicator: { alignItems: "center", marginTop: Spacing.xs },
  halfTimeText: { color: AppColors.warningYellow, fontWeight: "700" },
  periodIndicator: { alignItems: "center", marginTop: Spacing.xs },
  
  tabBar: { flexDirection: "row", marginHorizontal: Spacing.md, borderRadius: BorderRadius.sm, backgroundColor: AppColors.elevated, padding: 4, marginBottom: Spacing.sm, zIndex: 10 },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: "center", borderRadius: BorderRadius.xs },
  tabActive: { backgroundColor: AppColors.surface },
  tabText: { color: AppColors.textSecondary },
  tabTextActive: { color: "#FFFFFF", fontWeight: "600" },
  
  tabContent: { flex: 1, marginHorizontal: Spacing.md },
  
  eventsContainer: { flex: 1, backgroundColor: AppColors.surface, borderRadius: BorderRadius.md, overflow: "hidden" },
  emptyEvents: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.xl },
  eventsList: { padding: Spacing.sm },
  eventItem: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, backgroundColor: AppColors.surface, borderBottomWidth: 1, borderBottomColor: AppColors.elevated },
  eventTime: { color: AppColors.pitchGreen, fontWeight: "600", width: 60 },
  eventIconWrapper: { width: 30, alignItems: "center" },
  eventText: { flex: 1, color: AppColors.textSecondary },
  deleteEventAction: { width: 60, backgroundColor: AppColors.redCard, justifyContent: "center", alignItems: "center" },
  
  formationContainer: { flex: 1 },
  formationContent: { paddingBottom: Spacing.md },
  
  compactPitchContainer: { alignItems: "center", marginBottom: Spacing.sm },
  compactPitch: { width: "100%", aspectRatio: 2.2, backgroundColor: "#1a472a", borderRadius: BorderRadius.md, borderWidth: 2, borderColor: "#2a6a3a", position: "relative", overflow: "hidden" },
  compactCenterCircle: { position: "absolute", width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", left: "50%", top: "50%", marginLeft: -15, marginTop: -15 },
  compactCenterLine: { position: "absolute", width: 1.5, height: "100%", backgroundColor: "rgba(255,255,255,0.3)", left: "50%", marginLeft: -0.75 },
  compactGoalAreaLeft: { position: "absolute", width: 25, height: 50, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", borderLeftWidth: 0, left: 0, top: "50%", marginTop: -25 },
  compactGoalAreaRight: { position: "absolute", width: 25, height: 50, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", borderRightWidth: 0, right: 0, top: "50%", marginTop: -25 },
  compactPlayerCircle: { position: "absolute", width: 28, height: 28, borderRadius: 14, backgroundColor: AppColors.pitchGreen, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#FFFFFF" },
  compactPlayerText: { color: "#FFFFFF", fontWeight: "700", fontSize: 8 },
  
  expandedPitchContainer: { alignItems: "center", marginBottom: Spacing.sm },
  expandedPitch: { width: "100%", aspectRatio: 0.65, backgroundColor: "#1a472a", borderRadius: BorderRadius.md, borderWidth: 2, borderColor: "#2a6a3a", position: "relative", overflow: "hidden" },
  pitchPenaltyAreaTop: { position: "absolute", width: "55%", height: "18%", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopWidth: 0, left: "22.5%", top: 0 },
  pitchGoalBoxTop: { position: "absolute", width: "25%", height: "8%", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopWidth: 0, left: "37.5%", top: 0 },
  pitchPenaltyAreaBottom: { position: "absolute", width: "55%", height: "18%", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderBottomWidth: 0, left: "22.5%", bottom: 0 },
  pitchGoalBoxBottom: { position: "absolute", width: "25%", height: "8%", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderBottomWidth: 0, left: "37.5%", bottom: 0 },
  pitchCenterCircle: { position: "absolute", width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", left: "50%", top: "50%", marginLeft: -30, marginTop: -30 },
  pitchCenterLine: { position: "absolute", width: "100%", height: 2, backgroundColor: "rgba(255,255,255,0.3)", top: "50%", marginTop: -1 },
  
  tapHint: { color: AppColors.textDisabled, textAlign: "center", marginTop: Spacing.xs },
  
  playersGrid: { position: "absolute", width: "100%", height: "100%" },
  draggablePlayerCircle: { position: "absolute", width: 50, height: 50, borderRadius: 25, backgroundColor: AppColors.pitchGreen, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  playerCircleText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },
  
  benchContainer: { paddingVertical: Spacing.sm },
  benchLabel: { color: AppColors.textSecondary, marginBottom: Spacing.xs },
  benchList: { gap: Spacing.sm },
  benchPlayer: { backgroundColor: AppColors.elevated, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.xs },
  benchPlayerText: { color: AppColors.textSecondary },
  sentOffContainer: { marginTop: Spacing.sm },
  sentOffLabel: { color: AppColors.redCard, fontWeight: "600", marginBottom: Spacing.xs },
  sentOffList: { gap: Spacing.sm },
  sentOffPlayer: { backgroundColor: AppColors.redCard, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.xs },
  sentOffPlayerText: { color: "#FFFFFF", fontWeight: "600" },
  
  bottomBar: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.sm },
  actionButtonsRow: { flexDirection: "row", gap: Spacing.sm },
  actionButton: { flex: 1, height: Spacing.actionButtonHeight, borderRadius: BorderRadius.sm, justifyContent: "center", alignItems: "center", flexDirection: "row" },
  actionButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  goalButton: { backgroundColor: AppColors.pitchGreen },
  goalAgainstButton: { backgroundColor: "#4a4a4a" },
  cardButton: { backgroundColor: AppColors.warningYellow },
  penaltyButton: { backgroundColor: "#6a4a8a" },
  subButton: { backgroundColor: "#3a5a8a" },
  
  notesContainer: { flex: 1 },
  notesContentArea: { flex: 1, backgroundColor: AppColors.surface, borderRadius: BorderRadius.sm, margin: Spacing.sm },
  notesScrollView: { flex: 1 },
  notesScrollContent: { padding: Spacing.md },
  notesDisplayText: { color: AppColors.textPrimary, fontSize: 16, lineHeight: 24 },
  emptyNotes: { flex: 1, justifyContent: "center", alignItems: "center" },
});

const sheetStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { backgroundColor: AppColors.surface, borderTopLeftRadius: BorderRadius.lg, borderTopRightRadius: BorderRadius.lg, paddingTop: Spacing.md, paddingHorizontal: Spacing.lg, maxHeight: SCREEN_HEIGHT * 0.7 },
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
  penaltyTeamButton: { flexDirection: "row", alignItems: "center", gap: Spacing.md, backgroundColor: AppColors.elevated, padding: Spacing.xl, borderRadius: BorderRadius.md },
  penaltyTeamText: { fontSize: 16, fontWeight: "600" },
});

const confirmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: Spacing.xl },
  dialog: { backgroundColor: AppColors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, width: "100%", maxWidth: 320 },
  cardIconsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  cardIcon: { width: 24, height: 32, borderRadius: 3, marginHorizontal: 4 },
  title: { textAlign: "center", marginBottom: Spacing.md },
  message: { textAlign: "center", color: AppColors.textSecondary, marginBottom: Spacing.xl },
  buttons: { flexDirection: "row", gap: Spacing.md },
  cancelButton: { flex: 1, paddingVertical: Spacing.md, backgroundColor: AppColors.elevated, borderRadius: BorderRadius.sm, alignItems: "center" },
  cancelText: { color: AppColors.textSecondary },
  confirmButton: { flex: 1, paddingVertical: Spacing.md, backgroundColor: AppColors.redCard, borderRadius: BorderRadius.sm, alignItems: "center" },
  confirmText: { color: "#FFFFFF" },
});

const notesPopoutStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  popout: { 
    backgroundColor: AppColors.surface, 
    marginHorizontal: Spacing.md, 
    borderRadius: BorderRadius.lg, 
    padding: Spacing.lg,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: Spacing.md 
  },
  title: { color: AppColors.textPrimary },
  minimizeButton: { 
    width: 36, 
    height: 36, 
    borderRadius: BorderRadius.sm, 
    backgroundColor: AppColors.elevated, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  input: { 
    backgroundColor: AppColors.elevated, 
    borderRadius: BorderRadius.sm, 
    padding: Spacing.md, 
    color: AppColors.textPrimary, 
    fontSize: 16, 
    minHeight: 120, 
    maxHeight: 200,
    textAlignVertical: "top" 
  },
  hint: { color: AppColors.textSecondary, marginTop: Spacing.sm, textAlign: "center" },
});
