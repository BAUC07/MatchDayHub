import React, { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, Alert, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, AppColors, BorderRadius } from '@/constants/theme';
import { useRevenueCat } from '@/lib/revenuecat';
import { RootStackParamList } from '@/navigation/RootStackNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const FEATURES = [
  { icon: 'bar-chart-2', title: 'Advanced Statistics', description: 'Detailed player and team analytics' },
  { icon: 'users', title: 'Unlimited Teams', description: 'Manage all your teams in one place' },
  { icon: 'file-text', title: 'PDF Reports', description: 'Export and share season statistics' },
  { icon: 'calendar', title: 'Season Filtering', description: 'Filter stats by date range' },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { unlockWithCode } = useRevenueCat();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitCode = async () => {
    if (!code.trim()) {
      Alert.alert('Enter Code', 'Please enter your unlock code.');
      return;
    }

    Keyboard.dismiss();
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const success = await unlockWithCode(code);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Welcome to Elite!', 'You now have access to all premium features.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Invalid Code', 'The code you entered is not valid. Please check and try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={[styles.eliteBadge, { backgroundColor: AppColors.pitchGreen }]}>
            <Feather name="star" size={32} color="#000" />
          </View>
          <ThemedText style={styles.title}>MatchDay Elite</ThemedText>
          <ThemedText style={[styles.subtitle, { color: AppColors.textSecondary }]}>
            Unlock the full potential of your match management
          </ThemedText>
        </View>

        <View style={styles.featuresSection}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: AppColors.pitchGreen + '20' }]}>
                <Feather name={feature.icon as any} size={20} color={AppColors.pitchGreen} />
              </View>
              <View style={styles.featureText}>
                <ThemedText style={styles.featureTitle}>{feature.title}</ThemedText>
                <ThemedText style={[styles.featureDescription, { color: AppColors.textSecondary }]}>
                  {feature.description}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.codeSection}>
          <ThemedText style={styles.codeLabel}>Enter your unlock code</ThemedText>
          <TextInput
            style={[styles.codeInput, { 
              backgroundColor: AppColors.elevated,
              color: theme.text,
              borderColor: code.trim() ? AppColors.pitchGreen : AppColors.surface,
            }]}
            value={code}
            onChangeText={setCode}
            placeholder="Enter code"
            placeholderTextColor={AppColors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmitCode}
            editable={!isSubmitting}
          />
          <Pressable
            style={[
              styles.submitButton,
              { backgroundColor: AppColors.pitchGreen },
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitCode}
            disabled={isSubmitting}
          >
            <ThemedText style={styles.submitButtonText}>
              {isSubmitting ? 'Checking...' : 'Unlock Elite'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  eliteBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  featuresSection: {
    marginBottom: Spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
    flexShrink: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 14,
    flexWrap: 'wrap',
  },
  codeSection: {
    marginTop: Spacing.md,
  },
  codeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  codeInput: {
    height: 56,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    paddingHorizontal: Spacing.lg,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: Spacing.lg,
  },
  submitButton: {
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
});
