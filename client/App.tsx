import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RevenueCatProvider } from "@/lib/revenuecat";

// STEP 2 TEST: Simulate LiveMatchScreen timer logic without navigation
// This tests if the timer pattern from LiveMatchScreen works when rendered directly
const ENABLE_TIMER_TEST = false; // Disabled - testing complete

function TimerTestComponent() {
  const [matchTime, setMatchTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  
  // Log on every render - exactly like LiveMatchScreen
  console.log('[Step2Test] Component rendered, matchTime:', matchTime, 'isRunning:', isRunning);
  
  // Timer logic copied from LiveMatchScreen
  useEffect(() => {
    if (isRunning) {
      let timeoutId: ReturnType<typeof setTimeout>;
      
      const tick = () => {
        setMatchTime(prev => {
          const newValue = prev + 1;
          console.log('[Step2Test] setState called, new value:', newValue);
          return newValue;
        });
        timeoutId = setTimeout(tick, 1000);
      };
      
      timeoutId = setTimeout(tick, 1000);
      
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [isRunning]);
  
  // Format time like LiveMatchScreen
  const mins = Math.floor(matchTime / 60);
  const secs = matchTime % 60;
  const timeDisplay = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  return (
    <View style={testStyles.container}>
      <Text style={testStyles.title}>Step 2: LiveMatch Timer Test</Text>
      <Text style={testStyles.counter}>{timeDisplay}</Text>
      <Text style={testStyles.matchTime}>matchTime state: {matchTime}</Text>
      <Pressable 
        style={[testStyles.button, isRunning && testStyles.buttonStop]} 
        onPress={() => setIsRunning(prev => !prev)}
      >
        <Text style={testStyles.buttonText}>{isRunning ? 'STOP' : 'START'}</Text>
      </Pressable>
      <Text style={testStyles.subtitle}>Tap START, timer should count up</Text>
    </View>
  );
}

const testStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    marginBottom: 20,
  },
  counter: {
    color: '#00ff00',
    fontSize: 72,
    fontWeight: 'bold',
  },
  matchTime: {
    color: '#888',
    fontSize: 16,
    marginTop: 10,
  },
  button: {
    backgroundColor: '#00A86B',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 30,
  },
  buttonStop: {
    backgroundColor: '#DC143C',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 20,
  },
});

export default function App() {
  // STEP 1 TEST: Render minimal test component with no navigation/providers
  if (ENABLE_TIMER_TEST) {
    return <TimerTestComponent />;
  }
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RevenueCatProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={styles.root}>
              <KeyboardProvider>
                <NavigationContainer>
                  <RootStackNavigator />
                </NavigationContainer>
                <StatusBar style="auto" />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </RevenueCatProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
