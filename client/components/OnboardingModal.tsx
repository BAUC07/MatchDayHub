import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { AppColors, Spacing, BorderRadius } from "@/constants/theme";

interface OnboardingStep {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    icon: "users",
    title: "Create Your Team",
    description: "Start by adding your team with players and squad numbers.",
  },
  {
    icon: "user-plus",
    title: "Add Your Players",
    description: "Build your squad with player names and optional shirt numbers.",
  },
  {
    icon: "play-circle",
    title: "Log Matches Live",
    description: "Track goals, cards, and substitutions in real-time during matches.",
  },
];

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete();
  };

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <Pressable style={styles.skipButton} onPress={handleSkip}>
            <ThemedText type="small" style={styles.skipText}>
              Skip
            </ThemedText>
          </Pressable>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Feather name={step.icon} size={64} color={AppColors.pitchGreen} />
            </View>

            <ThemedText type="h2" style={styles.title}>
              {step.title}
            </ThemedText>

            <ThemedText type="body" style={styles.description}>
              {step.description}
            </ThemedText>
          </View>

          <View style={styles.footer}>
            <View style={styles.dotsContainer}>
              {ONBOARDING_STEPS.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentStep && styles.dotActive,
                  ]}
                />
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.nextButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleNext}
            >
              <ThemedText type="body" style={styles.nextButtonText}>
                {isLastStep ? "Get Started" : "Next"}
              </ThemedText>
              {!isLastStep ? (
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              ) : null}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { height } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: AppColors.darkBg,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    minHeight: height * 0.5,
  },
  skipButton: {
    alignSelf: "flex-end",
    padding: Spacing.sm,
  },
  skipText: {
    color: AppColors.textSecondary,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AppColors.elevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    color: AppColors.textSecondary,
    paddingHorizontal: Spacing.lg,
  },
  footer: {
    alignItems: "center",
    gap: Spacing.xl,
  },
  dotsContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.surface,
  },
  dotActive: {
    backgroundColor: AppColors.pitchGreen,
    width: 24,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: AppColors.pitchGreen,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    width: "100%",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
