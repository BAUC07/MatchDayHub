import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import StatsScreen from "@/screens/StatsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type StatsStackParamList = {
  Stats: undefined;
};

const Stack = createNativeStackNavigator<StatsStackParamList>();

export default function StatsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Stats"
        component={StatsScreen}
        options={{ headerTitle: "Stats" }}
      />
    </Stack.Navigator>
  );
}
