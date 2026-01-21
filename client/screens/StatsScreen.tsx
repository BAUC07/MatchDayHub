import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Svg, { Path, Circle, G, Text as SvgText } from "react-native-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, AppColors, BorderRadius } from "@/constants/theme";
import { Match, MatchEvent, Team, Player, SubscriptionState } from "@/types";
import { getMatches, getTeams, getSubscription } from "@/lib/storage";

type FilterType = "all" | "home" | "away";

interface PlayerStat {
  playerId: string;
  playerName: string;
  squadNumber?: number;
  count: number;
}

interface MinutesStat extends PlayerStat {
  matches: number;
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [matchesData, teamsData, subscriptionData] = await Promise.all([
        getMatches(),
        getTeams(),
        getSubscription(),
      ]);
      setMatches(matchesData.filter(m => m.isCompleted));
      setTeams(teamsData);
      setSubscription(subscriptionData);
      if (teamsData.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teamsData[0].id);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedTeamId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null;
  
  const filteredMatches = matches.filter((m) => {
    if (selectedTeamId && m.teamId !== selectedTeamId) return false;
    if (filter === "all") return true;
    return m.location === filter;
  });

  const getPlayerName = (playerId: string): string => {
    for (const team of teams) {
      const player = team.players.find((p) => p.id === playerId);
      if (player) return player.name;
    }
    return "Unknown";
  };

  const getPlayerSquadNumber = (playerId: string): number | undefined => {
    for (const team of teams) {
      const player = team.players.find((p) => p.id === playerId);
      if (player) return player.squadNumber;
    }
    return undefined;
  };

  const resultsData = {
    wins: filteredMatches.filter((m) => m.scoreFor > m.scoreAgainst).length,
    draws: filteredMatches.filter((m) => m.scoreFor === m.scoreAgainst).length,
    losses: filteredMatches.filter((m) => m.scoreFor < m.scoreAgainst).length,
  };

  const goalsData = (() => {
    let openPlay = 0;
    let corner = 0;
    let freeKick = 0;
    let penalty = 0;
    
    filteredMatches.forEach((match) => {
      match.events.forEach((event) => {
        if (event.type === "goal_for") {
          switch (event.goalType) {
            case "open_play": openPlay++; break;
            case "corner": corner++; break;
            case "free_kick": freeKick++; break;
            case "penalty": penalty++; break;
            default: openPlay++; break;
          }
        }
      });
    });
    
    return { openPlay, corner, freeKick, penalty };
  })();

  const topScorers: PlayerStat[] = (() => {
    const scorerMap = new Map<string, number>();
    
    filteredMatches.forEach((match) => {
      match.events.forEach((event) => {
        if (event.type === "goal_for" && event.playerId) {
          scorerMap.set(event.playerId, (scorerMap.get(event.playerId) || 0) + 1);
        }
      });
    });

    return Array.from(scorerMap.entries())
      .map(([playerId, count]) => ({
        playerId,
        playerName: getPlayerName(playerId),
        squadNumber: getPlayerSquadNumber(playerId),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const topAssists: PlayerStat[] = (() => {
    const assistMap = new Map<string, number>();
    
    filteredMatches.forEach((match) => {
      match.events.forEach((event) => {
        if (event.type === "goal_for" && event.assistPlayerId) {
          assistMap.set(event.assistPlayerId, (assistMap.get(event.assistPlayerId) || 0) + 1);
        }
      });
    });

    return Array.from(assistMap.entries())
      .map(([playerId, count]) => ({
        playerId,
        playerName: getPlayerName(playerId),
        squadNumber: getPlayerSquadNumber(playerId),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const cardsReceived: PlayerStat[] = (() => {
    const cardMap = new Map<string, { yellow: number; red: number }>();
    
    filteredMatches.forEach((match) => {
      match.events.forEach((event) => {
        if (event.type === "card" && event.playerId && event.isForTeam) {
          const current = cardMap.get(event.playerId) || { yellow: 0, red: 0 };
          if (event.cardType === "yellow") current.yellow++;
          if (event.cardType === "red") current.red++;
          cardMap.set(event.playerId, current);
        }
      });
    });

    return Array.from(cardMap.entries())
      .map(([playerId, cards]) => ({
        playerId,
        playerName: getPlayerName(playerId),
        squadNumber: getPlayerSquadNumber(playerId),
        count: cards.yellow + cards.red * 2,
        yellowCards: cards.yellow,
        redCards: cards.red,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const playerMinutes: MinutesStat[] = (() => {
    const minutesMap = new Map<string, { minutes: number; matches: number }>();
    
    filteredMatches.forEach((match) => {
      const matchDuration = match.totalMatchTime / 60;
      const playerTimes = new Map<string, { start: number; end: number }>();
      
      match.startingLineup.forEach((playerId) => {
        playerTimes.set(playerId, { start: 0, end: matchDuration });
      });
      
      match.events
        .filter((e) => e.type === "substitution")
        .sort((a, b) => a.timestamp - b.timestamp)
        .forEach((event) => {
          const subTime = event.timestamp / 60;
          if (event.playerOffId) {
            const existing = playerTimes.get(event.playerOffId);
            if (existing) {
              existing.end = subTime;
            }
          }
          if (event.playerOnId) {
            playerTimes.set(event.playerOnId, { start: subTime, end: matchDuration });
          }
        });
      
      playerTimes.forEach(({ start, end }, playerId) => {
        const played = Math.max(0, end - start);
        const current = minutesMap.get(playerId) || { minutes: 0, matches: 0 };
        current.minutes += played;
        current.matches += 1;
        minutesMap.set(playerId, current);
      });
    });

    return Array.from(minutesMap.entries())
      .map(([playerId, data]) => ({
        playerId,
        playerName: getPlayerName(playerId),
        squadNumber: getPlayerSquadNumber(playerId),
        count: Math.round(data.minutes),
        matches: data.matches,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  const handleExportPDF = useCallback(async () => {
    if (!selectedTeam) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const totalGoals = resultsData.wins + resultsData.draws + resultsData.losses > 0
      ? filteredMatches.reduce((sum, m) => sum + m.scoreFor, 0)
      : 0;
    const totalConceded = filteredMatches.reduce((sum, m) => sum + m.scoreAgainst, 0);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; background: #fff; color: #333; }
            h1 { color: #00A86B; border-bottom: 3px solid #00A86B; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            .stats-grid { display: flex; flex-wrap: wrap; gap: 20px; margin: 20px 0; }
            .stat-box { background: #f5f5f5; padding: 20px; border-radius: 8px; min-width: 120px; text-align: center; }
            .stat-value { font-size: 32px; font-weight: bold; color: #00A86B; }
            .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f5f5f5; font-weight: 600; }
            .number { text-align: center; width: 50px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${selectedTeam.name} - Season Statistics</h1>
          <p style="color: #666;">Generated on ${new Date().toLocaleDateString()}</p>
          
          <h2>Results Overview</h2>
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">${filteredMatches.length}</div>
              <div class="stat-label">Matches Played</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #4CAF50">${resultsData.wins}</div>
              <div class="stat-label">Wins</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #FF9800">${resultsData.draws}</div>
              <div class="stat-label">Draws</div>
            </div>
            <div class="stat-box">
              <div class="stat-value" style="color: #f44336">${resultsData.losses}</div>
              <div class="stat-label">Losses</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalGoals}</div>
              <div class="stat-label">Goals Scored</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalConceded}</div>
              <div class="stat-label">Goals Conceded</div>
            </div>
          </div>

          <h2>Goal Sources</h2>
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">${goalsData.openPlay}</div>
              <div class="stat-label">Open Play</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${goalsData.corner}</div>
              <div class="stat-label">Corners</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${goalsData.freeKick}</div>
              <div class="stat-label">Free Kicks</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${goalsData.penalty}</div>
              <div class="stat-label">Penalties</div>
            </div>
          </div>

          ${topScorers.length > 0 ? `
          <h2>Top Scorers</h2>
          <table>
            <tr><th class="number">#</th><th>Player</th><th class="number">Goals</th></tr>
            ${topScorers.map((p, i) => `
              <tr>
                <td class="number">${i + 1}</td>
                <td>${p.squadNumber ? p.squadNumber + '. ' : ''}${p.playerName}</td>
                <td class="number">${p.count}</td>
              </tr>
            `).join('')}
          </table>
          ` : ''}

          ${topAssists.length > 0 ? `
          <h2>Top Assists</h2>
          <table>
            <tr><th class="number">#</th><th>Player</th><th class="number">Assists</th></tr>
            ${topAssists.map((p, i) => `
              <tr>
                <td class="number">${i + 1}</td>
                <td>${p.squadNumber ? p.squadNumber + '. ' : ''}${p.playerName}</td>
                <td class="number">${p.count}</td>
              </tr>
            `).join('')}
          </table>
          ` : ''}

          ${cardsReceived.length > 0 ? `
          <h2>Disciplinary Record</h2>
          <table>
            <tr><th class="number">#</th><th>Player</th><th class="number" style="color: #FFD700">Yellow</th><th class="number" style="color: #DC143C">Red</th></tr>
            ${cardsReceived.map((p: any, i: number) => `
              <tr>
                <td class="number">${i + 1}</td>
                <td>${p.squadNumber ? p.squadNumber + '. ' : ''}${p.playerName}</td>
                <td class="number">${p.yellowCards}</td>
                <td class="number">${p.redCards}</td>
              </tr>
            `).join('')}
          </table>
          ` : ''}

          <div class="footer">
            MatchDay - Grassroots Football Match Logger
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      
      if (Platform.OS === "web") {
        Alert.alert("PDF Generated", "PDF export is not fully supported on web. Please use the mobile app for PDF export.");
        return;
      }
      
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${selectedTeam.name} Statistics`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Success", "PDF has been generated successfully.");
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    }
  }, [selectedTeam, filteredMatches, resultsData, goalsData, topScorers, topAssists, cardsReceived]);

  const renderPieChart = (
    data: { value: number; color: string; label: string }[],
    size: number = 120
  ) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) {
      return (
        <View style={[styles.pieChart, { width: size, height: size }]}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={size / 2 - 5}
              fill={AppColors.elevated}
            />
          </Svg>
          <View style={styles.pieChartCenter}>
            <ThemedText type="small" style={{ color: AppColors.textSecondary }}>
              No data
            </ThemedText>
          </View>
        </View>
      );
    }

    const radius = size / 2 - 5;
    const centerX = size / 2;
    const centerY = size / 2;
    let currentAngle = -90;

    const paths = data.map((segment, index) => {
      if (segment.value === 0) return null;
      
      const percentage = segment.value / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

      return (
        <Path key={index} d={pathData} fill={segment.color} />
      );
    });

    return (
      <View style={styles.pieChartContainer}>
        <Svg width={size} height={size}>
          <G>{paths}</G>
        </Svg>
        <View style={styles.pieLegend}>
          {data.map((segment, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
              <ThemedText type="small" style={styles.legendText}>
                {segment.label}: {segment.value}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderFilterButtons = () => (
    <View style={styles.filterRow}>
      {(["all", "home", "away"] as FilterType[]).map((f) => (
        <Pressable
          key={f}
          style={[
            styles.filterButton,
            filter === f && styles.filterButtonActive,
          ]}
          onPress={() => setFilter(f)}
        >
          <ThemedText
            type="small"
            style={[
              styles.filterButtonText,
              filter === f && styles.filterButtonTextActive,
            ]}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderTable = (
    title: string,
    data: PlayerStat[],
    valueLabel: string = "Count"
  ) => (
    <Card elevation={1} style={styles.tableCard}>
      <ThemedText type="h4" style={styles.tableTitle}>
        {title}
      </ThemedText>
      {data.length === 0 ? (
        <ThemedText type="small" style={styles.noDataText}>
          No data available
        </ThemedText>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.rankCell]}>
              #
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.playerCell]}>
              Player
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.valueCell]}>
              {valueLabel}
            </ThemedText>
          </View>
          {data.map((item, index) => (
            <View key={item.playerId} style={styles.tableRow}>
              <ThemedText type="body" style={[styles.tableCell, styles.rankCell]}>
                {index + 1}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.playerCell]} numberOfLines={1}>
                {item.squadNumber ? `${item.squadNumber}. ` : ""}{item.playerName}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.valueCell]}>
                {item.count}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  const renderCardsTable = () => (
    <Card elevation={1} style={styles.tableCard}>
      <ThemedText type="h4" style={styles.tableTitle}>
        Cards Received
      </ThemedText>
      {cardsReceived.length === 0 ? (
        <ThemedText type="small" style={styles.noDataText}>
          No cards recorded
        </ThemedText>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.rankCell]}>
              #
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.playerCell]}>
              Player
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.cardCell]}>
              Y
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.cardCell]}>
              R
            </ThemedText>
          </View>
          {cardsReceived.map((item: any, index) => (
            <View key={item.playerId} style={styles.tableRow}>
              <ThemedText type="body" style={[styles.tableCell, styles.rankCell]}>
                {index + 1}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.playerCell]} numberOfLines={1}>
                {item.squadNumber ? `${item.squadNumber}. ` : ""}{item.playerName}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.cardCell, { color: AppColors.warningYellow }]}>
                {item.yellowCards}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.cardCell, { color: AppColors.redCard }]}>
                {item.redCards}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  const renderMinutesTable = () => (
    <Card elevation={1} style={styles.tableCard}>
      <ThemedText type="h4" style={styles.tableTitle}>
        Minutes Played
      </ThemedText>
      {playerMinutes.length === 0 ? (
        <ThemedText type="small" style={styles.noDataText}>
          No data available
        </ThemedText>
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.rankCell]}>
              #
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.playerCell]}>
              Player
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.valueCell]}>
              Mins
            </ThemedText>
            <ThemedText type="small" style={[styles.tableHeaderCell, styles.cardCell]}>
              MP
            </ThemedText>
          </View>
          {playerMinutes.map((item, index) => (
            <View key={item.playerId} style={styles.tableRow}>
              <ThemedText type="body" style={[styles.tableCell, styles.rankCell]}>
                {index + 1}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.playerCell]} numberOfLines={1}>
                {item.squadNumber ? `${item.squadNumber}. ` : ""}{item.playerName}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.valueCell]}>
                {item.count}
              </ThemedText>
              <ThemedText type="body" style={[styles.tableCell, styles.cardCell]}>
                {item.matches}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText type="body">Loading stats...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!subscription?.isElite) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.lockedContainer, { paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl }]}>
          <View style={styles.lockedIcon}>
            <Feather name="lock" size={48} color={AppColors.pitchGreen} />
          </View>
          <ThemedText type="h3" style={styles.lockedTitle}>
            Elite Feature
          </ThemedText>
          <ThemedText type="body" style={styles.lockedText}>
            Upgrade to Elite to unlock detailed match statistics and performance insights.
          </ThemedText>
          <View style={styles.lockedFeatures}>
            <View style={styles.lockedFeatureItem}>
              <Feather name="check" size={18} color={AppColors.pitchGreen} />
              <ThemedText type="body" style={styles.lockedFeatureText}>Results breakdown</ThemedText>
            </View>
            <View style={styles.lockedFeatureItem}>
              <Feather name="check" size={18} color={AppColors.pitchGreen} />
              <ThemedText type="body" style={styles.lockedFeatureText}>Goal source analysis</ThemedText>
            </View>
            <View style={styles.lockedFeatureItem}>
              <Feather name="check" size={18} color={AppColors.pitchGreen} />
              <ThemedText type="body" style={styles.lockedFeatureText}>Top scorers and assists</ThemedText>
            </View>
            <View style={styles.lockedFeatureItem}>
              <Feather name="check" size={18} color={AppColors.pitchGreen} />
              <ThemedText type="body" style={styles.lockedFeatureText}>Minutes played tracking</ThemedText>
            </View>
          </View>
          <Pressable style={styles.upgradeButton}>
            <ThemedText type="body" style={styles.upgradeButtonText}>
              Upgrade to Elite
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <ThemedText type="h2" style={styles.screenTitle}>
            Statistics
          </ThemedText>
          <Pressable
            style={({ pressed }) => [
              styles.exportButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={handleExportPDF}
          >
            <Feather name="download" size={18} color="#FFFFFF" />
            <ThemedText type="small" style={styles.exportButtonText}>
              Export
            </ThemedText>
          </Pressable>
        </View>

        {teams.length > 1 ? (
          <View style={styles.teamSelectorContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.teamSelectorScroll}
            >
              {teams.map((team) => (
                <Pressable
                  key={team.id}
                  style={[
                    styles.teamSelectorButton,
                    selectedTeamId === team.id && styles.teamSelectorButtonActive,
                  ]}
                  onPress={() => setSelectedTeamId(team.id)}
                >
                  <ThemedText
                    type="small"
                    style={[
                      styles.teamSelectorText,
                      selectedTeamId === team.id && styles.teamSelectorTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {team.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {renderFilterButtons()}

        <ThemedText type="small" style={styles.matchCount}>
          {filteredMatches.length} completed {filteredMatches.length === 1 ? "match" : "matches"}
        </ThemedText>

        <Card elevation={1} style={styles.chartCard}>
          <ThemedText type="h4" style={styles.chartTitle}>
            Results
          </ThemedText>
          {renderPieChart([
            { value: resultsData.wins, color: AppColors.pitchGreen, label: "Wins" },
            { value: resultsData.draws, color: "#666666", label: "Draws" },
            { value: resultsData.losses, color: AppColors.redCard, label: "Losses" },
          ])}
        </Card>

        <Card elevation={1} style={styles.chartCard}>
          <ThemedText type="h4" style={styles.chartTitle}>
            Goal Sources
          </ThemedText>
          {renderPieChart([
            { value: goalsData.openPlay, color: AppColors.pitchGreen, label: "Open Play" },
            { value: goalsData.corner, color: "#3a5a8a", label: "Corner" },
            { value: goalsData.freeKick, color: "#6a4a8a", label: "Free Kick" },
            { value: goalsData.penalty, color: "#f57c00", label: "Penalty" },
          ])}
        </Card>

        {renderTable("Top Scorers", topScorers, "Goals")}
        {renderTable("Top Assists", topAssists, "Assists")}
        {renderCardsTable()}
        {renderMinutesTable()}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  lockedContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    paddingHorizontal: Spacing.xl 
  },
  lockedIcon: { 
    width: 100, 
    height: 100, 
    borderRadius: 50, 
    backgroundColor: AppColors.surface, 
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: Spacing.xl 
  },
  lockedTitle: { 
    textAlign: "center", 
    marginBottom: Spacing.md 
  },
  lockedText: { 
    textAlign: "center", 
    color: AppColors.textSecondary, 
    marginBottom: Spacing.xl 
  },
  lockedFeatures: { 
    marginBottom: Spacing.xl, 
    width: "100%" 
  },
  lockedFeatureItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: Spacing.sm, 
    gap: Spacing.sm 
  },
  lockedFeatureText: { 
    color: AppColors.textSecondary 
  },
  upgradeButton: { 
    backgroundColor: AppColors.pitchGreen, 
    paddingVertical: Spacing.md, 
    paddingHorizontal: Spacing.xl, 
    borderRadius: BorderRadius.md 
  },
  upgradeButtonText: { 
    color: "#FFFFFF", 
    fontWeight: "700" 
  },
  scrollContent: { paddingHorizontal: Spacing.lg },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  screenTitle: { flex: 1 },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: AppColors.pitchGreen,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  exportButtonText: { color: "#FFFFFF", fontWeight: "600" },
  teamSelectorContainer: { marginBottom: Spacing.md },
  teamSelectorScroll: { gap: Spacing.sm },
  teamSelectorButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.elevated,
  },
  teamSelectorButtonActive: {
    backgroundColor: AppColors.pitchGreen,
    borderColor: AppColors.pitchGreen,
  },
  teamSelectorText: { color: AppColors.textSecondary },
  teamSelectorTextActive: { color: "#FFFFFF", fontWeight: "600" },
  filterRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  filterButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    backgroundColor: AppColors.elevated,
  },
  filterButtonActive: { backgroundColor: AppColors.pitchGreen },
  filterButtonText: { color: AppColors.textSecondary },
  filterButtonTextActive: { color: "#FFFFFF" },
  matchCount: { color: AppColors.textSecondary, marginBottom: Spacing.lg },
  chartCard: { marginBottom: Spacing.lg, padding: Spacing.lg },
  chartTitle: { marginBottom: Spacing.md },
  pieChartContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pieChart: { justifyContent: "center", alignItems: "center" },
  pieChartCenter: { position: "absolute", justifyContent: "center", alignItems: "center" },
  pieLegend: { flex: 1, marginLeft: Spacing.lg },
  legendItem: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.xs },
  legendText: { color: AppColors.textSecondary },
  tableCard: { marginBottom: Spacing.lg, padding: Spacing.lg },
  tableTitle: { marginBottom: Spacing.md },
  noDataText: { color: AppColors.textSecondary, textAlign: "center", paddingVertical: Spacing.md },
  table: { borderRadius: BorderRadius.xs, overflow: "hidden" },
  tableHeader: { flexDirection: "row", backgroundColor: AppColors.elevated, paddingVertical: Spacing.sm },
  tableHeaderCell: { color: AppColors.textSecondary, fontWeight: "600" },
  tableRow: { flexDirection: "row", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: AppColors.elevated },
  tableCell: { color: "#FFFFFF" },
  rankCell: { width: 30, textAlign: "center" },
  playerCell: { flex: 1, paddingRight: Spacing.sm },
  valueCell: { width: 50, textAlign: "center" },
  cardCell: { width: 30, textAlign: "center" },
});
