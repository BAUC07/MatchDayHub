import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text } from "react-native";
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

// STEP 1 TEST: Minimal timer component to prove React can re-render
// Set ENABLE_TIMER_TEST to true to run the test
const ENABLE_TIMER_TEST = true;

function TimerTestComponent() {
  const [counter, setCounter] = useState(0);
  
  // Log on every render
  console.log('[TimerTest] Component rendered, counter:', counter);
  
  useEffect(() => {
    const id = setTimeout(() => {
      setCounter(prev => prev + 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [counter]);
  
  return (
    <View style={testStyles.container}>
      <Text style={testStyles.title}>Timer Test</Text>
      <Text style={testStyles.counter}>{counter}</Text>
      <Text style={testStyles.subtitle}>This should increment every second</Text>
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
