import React, { useState, useCallback } from "react";
import { View, StyleSheet, TextInput, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { HeaderButton } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Team } from "@/types";
import { saveTeam, generateId, saveTeamLogo } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CreateTeamScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [teamName, setTeamName] = useState("");
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isValid = teamName.trim().length >= 2;

  const handlePickLogo = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLogoUri(result.assets[0].uri);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!isValid || saving) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);

    try {
      const teamId = generateId();
      let permanentLogoUri: string | undefined;
      
      if (logoUri) {
        permanentLogoUri = await saveTeamLogo(logoUri, teamId);
      }
      
      const newTeam: Team = {
        id: teamId,
        name: teamName.trim(),
        logoUri: permanentLogoUri,
        players: [],
        createdAt: new Date().toISOString(),
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0,
      };

      await saveTeam(newTeam);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error("Error saving team:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [isValid, saving, teamName, navigation]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton onPress={() => navigation.goBack()}>
          <ThemedText type="body" style={{ color: AppColors.pitchGreen }}>
            Cancel
          </ThemedText>
        </HeaderButton>
      ),
      headerRight: () => (
        <HeaderButton onPress={handleSave} disabled={!isValid || saving}>
          <ThemedText
            type="body"
            style={{
              color: isValid && !saving ? AppColors.pitchGreen : AppColors.textDisabled,
              fontWeight: "600",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </ThemedText>
        </HeaderButton>
      ),
    });
  }, [navigation, handleSave, isValid, saving]);

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <Pressable
        style={styles.iconContainer}
        onPress={handlePickLogo}
      >
        <View style={styles.teamIcon}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logoImage} />
          ) : (
            <Feather name="shield" size={48} color={AppColors.pitchGreen} />
          )}
        </View>
        <View style={styles.editBadge}>
          <Feather name="camera" size={14} color="#FFFFFF" />
        </View>
        <ThemedText type="small" style={styles.logoHint}>
          Tap to add club logo
        </ThemedText>
      </Pressable>

      <ThemedText type="small" style={styles.label}>
        TEAM NAME
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: AppColors.surface,
            color: theme.text,
          },
        ]}
        value={teamName}
        onChangeText={setTeamName}
        placeholder="Enter team name"
        placeholderTextColor={AppColors.textDisabled}
        autoFocus
        maxLength={50}
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />

      <ThemedText type="small" style={styles.hint}>
        You can add players after creating the team
      </ThemedText>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  teamIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: AppColors.surface,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: "absolute",
    bottom: 24,
    right: "35%",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AppColors.pitchGreen,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: AppColors.darkBg,
  },
  logoHint: {
    color: AppColors.textSecondary,
    marginTop: Spacing.sm,
  },
  label: {
    color: AppColors.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  hint: {
    color: AppColors.textSecondary,
    marginLeft: Spacing.xs,
  },
});
