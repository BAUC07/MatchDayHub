import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TeamsScreen from "@/screens/TeamsScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type TeamsStackParamList = {
  Teams: undefined;
};

const Stack = createNativeStackNavigator<TeamsStackParamList>();

export default function TeamsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Teams"
        component={TeamsScreen}
        options={{
          headerTitle: () => <HeaderTitle title="MatchDay" />,
        }}
      />
    </Stack.Navigator>
  );
}
