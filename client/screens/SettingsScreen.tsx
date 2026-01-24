import React, { useCallback } from "react";
import { View, StyleSheet, Image, Pressable, Switch, ScrollView, Linking, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { useRevenueCat } from "@/lib/revenuecat";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { isElite, restorePurchases } = useRevenueCat();

  const handleUpgrade = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Paywall");
  }, [navigation]);

  const handleManageSubscription = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      await Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else if (Platform.OS === 'android') {
      await Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  }, []);

  const handleRestorePurchases = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const restored = await restorePurchases();
      if (restored) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Restored!', 'Your Elite subscription has been restored.');
      } else {
        Alert.alert('No Purchases Found', 'We could not find any previous purchases to restore.');
      }
    } catch (error: any) {
      Alert.alert('Restore Failed', error.message || 'Something went wrong');
    }
  }, [restorePurchases]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Card elevation={2} style={styles.profileCard}>
        <View style={styles.profileContent}>
          <Image
            source={require("../../assets/images/profile-avatar.png")}
            style={styles.avatar}
            resizeMode="cover"
          />
          <View style={styles.profileInfo}>
            <ThemedText type="h4">Manager</ThemedText>
            <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
              {isElite ? "Elite Member" : "Free Plan"}
            </ThemedText>
          </View>
        </View>
      </Card>

      <ThemedText type="small" style={styles.sectionTitle}>
        SUBSCRIPTION
      </ThemedText>

      <Card elevation={2} style={styles.subscriptionCard}>
        <View style={styles.subscriptionHeader}>
          <View style={styles.planInfo}>
            <Feather
              name={isElite ? "star" : "zap"}
              size={24}
              color={isElite ? AppColors.warningYellow : AppColors.pitchGreen}
            />
            <View style={styles.planText}>
              <ThemedText type="h4">
                {isElite ? "Elite" : "Free Plan"}
              </ThemedText>
              <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
                {isElite
                  ? "Unlimited teams and stats"
                  : "1 team maximum"}
              </ThemedText>
            </View>
          </View>
        </View>

        {isElite ? (
          <Pressable
            style={({ pressed }) => [
              styles.manageButton,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleManageSubscription}
          >
            <ThemedText type="body" style={{ color: AppColors.pitchGreen }}>
              Manage Subscription
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.upgradeContainer}>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <Feather name="check" size={16} color={AppColors.pitchGreen} />
                <ThemedText type="small">Unlimited teams</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <Feather name="check" size={16} color={AppColors.pitchGreen} />
                <ThemedText type="small">Full match history</ThemedText>
              </View>
              <View style={styles.featureItem}>
                <Feather name="check" size={16} color={AppColors.pitchGreen} />
                <ThemedText type="small">Team statistics and PDF export</ThemedText>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.upgradeButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleUpgrade}
            >
              <ThemedText type="body" style={styles.upgradeButtonText}>
                Upgrade to Elite
              </ThemedText>
            </Pressable>
            
            <Pressable
              style={({ pressed }) => [
                styles.restoreButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleRestorePurchases}
            >
              <ThemedText type="small" style={{ color: AppColors.textSecondary, textDecorationLine: 'underline' }}>
                Restore Purchases
              </ThemedText>
            </Pressable>
          </View>
        )}
      </Card>

      <ThemedText type="small" style={styles.sectionTitle}>
        ABOUT
      </ThemedText>

      <Card elevation={2} style={styles.aboutCard}>
        <View style={styles.aboutItem}>
          <ThemedText type="body">Version</ThemedText>
          <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
            1.0.14
          </ThemedText>
        </View>
        <View style={styles.divider} />
        <View style={styles.aboutItem}>
          <ThemedText type="body">Build</ThemedText>
          <ThemedText type="body" style={{ color: AppColors.textSecondary }}>
            MVP
          </ThemedText>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  profileCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: Spacing.lg,
    backgroundColor: AppColors.surface,
  },
  profileInfo: {
    flex: 1,
  },
  sectionTitle: {
    color: AppColors.textSecondary,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  subscriptionCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  subscriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  planText: {
    marginLeft: Spacing.md,
  },
  manageButton: {
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  upgradeContainer: {
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: AppColors.elevated,
    paddingTop: Spacing.lg,
  },
  featureList: {
    marginBottom: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  upgradeButton: {
    backgroundColor: AppColors.pitchGreen,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  upgradeButtonText: {
    color: "#FFFFFF",
  },
  restoreButton: {
    alignItems: "center",
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  aboutCard: {
    padding: Spacing.lg,
  },
  aboutItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.elevated,
    marginVertical: Spacing.md,
  },
});
