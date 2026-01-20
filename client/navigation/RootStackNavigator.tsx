import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import TeamDetailScreen from "@/screens/TeamDetailScreen";
import SquadEditorScreen from "@/screens/SquadEditorScreen";
import MatchSetupScreen from "@/screens/MatchSetupScreen";
import LiveMatchScreen from "@/screens/LiveMatchScreen";
import MatchSummaryScreen from "@/screens/MatchSummaryScreen";
import CreateTeamScreen from "@/screens/CreateTeamScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { Team, Match } from "@/types";

export type RootStackParamList = {
  Main: undefined;
  TeamDetail: { teamId: string };
  SquadEditor: { teamId: string };
  CreateTeam: undefined;
  MatchSetup: { teamId: string };
  LiveMatch: { matchId: string };
  MatchSummary: { matchId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const opaqueOptions = useScreenOptions({ transparent: false });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TeamDetail"
        component={TeamDetailScreen}
        options={{ headerTitle: "Team" }}
      />
      <Stack.Screen
        name="SquadEditor"
        component={SquadEditorScreen}
        options={{ headerTitle: "Edit Squad" }}
      />
      <Stack.Screen
        name="CreateTeam"
        component={CreateTeamScreen}
        options={{
          presentation: "modal",
          headerTitle: "New Team",
        }}
      />
      <Stack.Screen
        name="MatchSetup"
        component={MatchSetupScreen}
        options={{ headerTitle: "Match Setup" }}
      />
      <Stack.Screen
        name="LiveMatch"
        component={LiveMatchScreen}
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="MatchSummary"
        component={MatchSummaryScreen}
        options={{
          headerTitle: "Match Summary",
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}
