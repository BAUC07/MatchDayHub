import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MatchesScreen from "@/screens/MatchesScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type MatchesStackParamList = {
  Matches: undefined;
};

const Stack = createNativeStackNavigator<MatchesStackParamList>();

export default function MatchesStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Matches"
        component={MatchesScreen}
        options={{
          headerTitle: "Match History",
        }}
      />
    </Stack.Navigator>
  );
}
