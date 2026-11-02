import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  Dumbbell,
  Flame,
  LineChart,
  Trophy,
  User,
} from "lucide-react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { AnalyticsScreen } from "../screens/AnalyticsScreen";
import { LeaderboardScreen } from "../screens/LeaderboardScreen";
import { LiveWorkoutScreen } from "../screens/LiveWorkoutScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { WorkoutsScreen } from "../screens/WorkoutsScreen";
import { colors } from "../theme/colors";
import type { RootTabParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Workouts"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
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
          tabBarLabel: "Рейтинг",
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
  tabBar: {
    backgroundColor: colors.bg.dark,
    borderTopColor: colors.border.subtle,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
});
