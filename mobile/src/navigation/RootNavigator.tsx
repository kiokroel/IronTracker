import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  Dumbbell,
  Flame,
  LineChart,
  Trophy,
  User,
} from "lucide-react-native";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { LeaderboardScreen } from "../screens/LeaderboardScreen";
import { LiveWorkoutScreen } from "../screens/LiveWorkoutScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { WorkoutsScreen } from "../screens/WorkoutsScreen";
import { useAuthStore } from "../store/useAuthStore";
import { colors } from "../theme/colors";
import { AuthNavigator } from "./AuthNavigator";
import type { RootTabParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.splashCircle}>
          <Dumbbell size={48} color={colors.brand.primary} />
        </View>
        <Text style={styles.splashTitle}>IronTracker</Text>
        <ActivityIndicator
          size="large"
          color={colors.brand.primary}
          style={styles.spinner}
        />
        <Text style={styles.loadingText}>Проверка сессии...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthNavigator />;
  }

  return (
    <Tab.Navigator
      initialRouteName="Workouts"
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 56 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 6),
          },
        ],
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Workouts"
        component={WorkoutsScreen}
        options={{
          tabBarLabel: "Дневник",
          tabBarIcon: ({ color, size }) => (
            <Dumbbell size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Live"
        component={LiveWorkoutScreen}
        options={{
          tabBarLabel: "Live",
          tabBarIcon: ({ color, size }) => (
            <Flame size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: "Лидерборд",
          tabBarIcon: ({ color, size }) => (
            <Trophy size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: "Аналитика",
          tabBarIcon: ({ color, size }) => (
            <LineChart size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Профиль",
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.darkest,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  splashCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "rgba(249, 115, 22, 0.4)",
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  tabBar: {
    backgroundColor: colors.bg.dark,
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
});
