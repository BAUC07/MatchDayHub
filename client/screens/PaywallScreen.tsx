import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
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
  { icon: 'award', title: 'Priority Support', description: 'Get help when you need it' },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { currentOffering, purchasePackage, restorePurchases, isLoading } = useRevenueCat();

  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handlePurchase = async (packageId: string) => {
    if (!currentOffering) return;

    const pkg = currentOffering.availablePackages.find(p => 
      p.identifier === packageId || p.packageType === packageId
    );
    
    if (!pkg) {
      Alert.alert('Error', 'Package not found');
      return;
    }

    try {
      setPurchasing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await purchasePackage(pkg);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Welcome to Elite!', 'You now have access to all premium features.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', error.message || 'Something went wrong');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoring(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const restored = await restorePurchases();
      if (restored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Restored!', 'Your Elite subscription has been restored.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.');
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error.message || 'Something went wrong');
    } finally {
      setRestoring(false);
    }
  };

  const renderPackage = (identifier: string, title: string, priceLabel: string, periodLabel: string, highlight?: boolean) => {
    const pkg = currentOffering?.availablePackages.find(p => 
      p.identifier.toLowerCase().includes(identifier.toLowerCase()) ||
      p.packageType.toLowerCase() === identifier.toLowerCase()
    );

    const price = pkg?.product.priceString || priceLabel;
    
    return (
      <Pressable
        key={identifier}
        style={[
          styles.packageCard,
          { backgroundColor: AppColors.elevated },
          highlight && { borderColor: AppColors.pitchGreen, borderWidth: 2 }
        ]}
        onPress={() => pkg && handlePurchase(pkg.identifier)}
        disabled={purchasing || !pkg}
      >
        {highlight && (
          <View style={[styles.popularBadge, { backgroundColor: AppColors.pitchGreen }]}>
            <ThemedText style={styles.popularText}>BEST VALUE</ThemedText>
          </View>
        )}
        <ThemedText style={styles.packageTitle}>{title}</ThemedText>
        <ThemedText style={styles.packagePrice}>{price}</ThemedText>
        <ThemedText style={[styles.packagePeriod, { color: AppColors.textSecondary }]}>
          {periodLabel}
        </ThemedText>
      </Pressable>
    );
  };

  if (Platform.OS === 'web') {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.webMessage}>
          <Feather name="smartphone" size={64} color={AppColors.pitchGreen} />
          <ThemedText style={styles.webTitle}>Subscriptions Available on Mobile</ThemedText>
          <ThemedText style={[styles.webSubtitle, { color: AppColors.textSecondary }]}>
            Open MatchDay in Expo Go on your iOS or Android device to subscribe to Elite.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        {isLoading ? (
          <ActivityIndicator size="large" color={AppColors.pitchGreen} style={styles.loader} />
        ) : (
          <View style={styles.packagesSection}>
            {renderPackage('monthly', 'Monthly', '$4.99', 'per month')}
            {renderPackage('yearly', 'Yearly', '$29.99', 'per year', true)}
            {renderPackage('lifetime', 'Lifetime', '$49.99', 'one-time purchase')}
          </View>
        )}

        {purchasing && (
          <View style={styles.purchasingOverlay}>
            <ActivityIndicator size="large" color={AppColors.pitchGreen} />
            <ThemedText style={styles.purchasingText}>Processing...</ThemedText>
          </View>
        )}

        <Pressable 
          style={styles.restoreButton} 
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={AppColors.textSecondary} />
          ) : (
            <ThemedText style={[styles.restoreText, { color: AppColors.textSecondary }]}>
              Restore Purchases
            </ThemedText>
          )}
        </Pressable>

        <ThemedText style={[styles.legalText, { color: AppColors.textSecondary }]}>
          Payment will be charged to your Apple ID account. Subscription automatically renews unless canceled at least 24 hours before the end of the current period.
        </ThemedText>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
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
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 14,
  },
  packagesSection: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  packageCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomLeftRadius: BorderRadius.md,
  },
  popularText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  packageTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  packagePrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppColors.pitchGreen,
  },
  packagePeriod: {
    fontSize: 14,
  },
  loader: {
    marginVertical: Spacing.xl,
  },
  purchasingOverlay: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  purchasingText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  restoreText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  legalText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  webMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  webTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  webSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
});
