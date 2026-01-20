import { Platform } from "react-native";

export const AppColors = {
  pitchGreen: "#00A86B",
  refereeBlack: "#1A1A1A",
  warningYellow: "#FFD700",
  redCard: "#DC143C",
  darkBg: "#0D0D0D",
  surface: "#1F1F1F",
  elevated: "#2A2A2A",
  textPrimary: "#FFFFFF",
  textSecondary: "#B3B3B3",
  textDisabled: "#4D4D4D",
};

export const Colors = {
  light: {
    text: "#FFFFFF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#B3B3B3",
    tabIconSelected: AppColors.pitchGreen,
    link: AppColors.pitchGreen,
    backgroundRoot: AppColors.darkBg,
    backgroundDefault: AppColors.surface,
    backgroundSecondary: AppColors.elevated,
    backgroundTertiary: "#353535",
  },
  dark: {
    text: "#FFFFFF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#B3B3B3",
    tabIconSelected: AppColors.pitchGreen,
    link: AppColors.pitchGreen,
    backgroundRoot: AppColors.darkBg,
    backgroundDefault: AppColors.surface,
    backgroundSecondary: AppColors.elevated,
    backgroundTertiary: "#353535",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
  actionButtonHeight: 72,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  hero: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
};
