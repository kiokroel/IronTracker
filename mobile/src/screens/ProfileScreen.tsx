import {
  Calendar,
  Globe,
  LogOut,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react-native";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { getApiBaseUrl, setApiBaseUrl } from "../api/client";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Header } from "../components/common/Header";
import { Input } from "../components/common/Input";
import { useAuthStore } from "../store/useAuthStore";
import { colors } from "../theme/colors";

export const ProfileScreen: React.FC = () => {
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const { user, logout, isLoading } = useAuthStore();

  const handleSaveApiUrl = () => {
    if (!apiUrl.trim().startsWith("http")) {
      Alert.alert("Ошибка", "URL должен начинаться с http:// или https://");
      return;
    }
    setApiBaseUrl(apiUrl.trim());
    Alert.alert("Успешно", `Базовый адрес API обновлен на:\n${apiUrl.trim()}`);
  };

  const handleLogout = () => {
    Alert.alert(
      "Выход из аккаунта",
      "Вы уверены, что хотите завершить текущую сессию?",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Выйти",
          style: "destructive",
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Недавно";

  return (
    <View style={styles.screen}>
      <Header
        title="Профиль атлета"
        subtitle="Настройки аккаунта и подключение"
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.userCard}>
          <View style={styles.avatarCircle}>
            <User size={36} color={colors.brand.primary} />
          </View>
          <Text style={styles.username}>{user?.username || "Атлет"}</Text>
          <Text style={styles.userEmail}>{user?.email || "athlete@irontracker.io"}</Text>

          <View style={styles.statusBadge}>
            <ShieldCheck size={14} color={colors.status.success} />
            <Text style={styles.statusText}>JWT Сессия активна</Text>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Mail size={14} color={colors.text.secondary} />
              <Text style={styles.detailText}>{user?.email}</Text>
            </View>
            <View style={styles.detailItem}>
              <Calendar size={14} color={colors.text.secondary} />
              <Text style={styles.detailText}>В клубе с {formattedDate}</Text>
            </View>
          </View>
        </Card>

        <Text style={styles.sectionHeader}>СЕТЕВОЕ ПОДКЛЮЧЕНИЕ К СЕРВЕРУ</Text>

        <Card>
          <View style={styles.settingHeader}>
            <Globe size={18} color={colors.brand.primary} />
            <Text style={styles.settingTitle}>Адрес Caddy API Gateway</Text>
          </View>
          <Text style={styles.settingDescription}>
            Для физического Android устройства укажите локальный IP вашего ПК (например, http://192.168.1.50:80/api/v1). Для эмулятора: http://10.0.2.2:80/api/v1.
          </Text>

          <Input
            label="API Base URL"
            value={apiUrl}
            onChangeText={setApiUrl}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Button
            title="Сохранить адрес сервера"
            variant="secondary"
            size="sm"
            onPress={handleSaveApiUrl}
            style={styles.saveBtn}
          />
        </Card>

        <Button
          title="Выйти из аккаунта"
          variant="outline"
          onPress={handleLogout}
          loading={isLoading}
          style={styles.logoutBtn}
          icon={<LogOut size={16} color={colors.brand.primary} />}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.darkest,
  },
  content: {
    padding: 16,
  },
  userCard: {
    alignItems: "center",
    paddingVertical: 24,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  username: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text.primary,
  },
  userEmail: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.status.success,
    marginLeft: 6,
  },
  detailsRow: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: 12,
    marginTop: 4,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  detailText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginLeft: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.muted,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  settingHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text.primary,
    marginLeft: 8,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  saveBtn: {
    marginTop: 8,
  },
  logoutBtn: {
    marginTop: 24,
    marginBottom: 40,
  },
});
