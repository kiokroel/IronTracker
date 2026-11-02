import { Dumbbell, LogIn } from "lucide-react-native";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button } from "../../components/common/Button";
import { Card } from "../../components/common/Card";
import { Input } from "../../components/common/Input";
import { useAuthStore } from "../../store/useAuthStore";
import { colors } from "../../theme/colors";

interface LoginScreenProps {
  onNavigateToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateToRegister,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      return;
    }
    try {
      await login({ email: email.trim(), password });
    } catch {
      // Error is set in store
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "android" ? "height" : "padding"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Dumbbell size={40} color={colors.brand.primary} />
          </View>
          <Text style={styles.brandTitle}>IronTracker</Text>
          <Text style={styles.subtitle}>
            Система учета тренировок и соревновательного лидерборда
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Вход в аккаунт</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label="Email"
            placeholder="athlete@example.com"
            value={email}
            onChangeText={(val) => {
              if (error) clearError();
              setEmail(val);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Пароль"
            placeholder="••••••••"
            value={password}
            onChangeText={(val) => {
              if (error) clearError();
              setPassword(val);
            }}
            secureTextEntry
            autoCapitalize="none"
          />

          <Button
            title="Войти"
            onPress={handleLogin}
            loading={isLoading}
            disabled={!email || !password || isLoading}
            style={styles.submitBtn}
            icon={<LogIn size={18} color="#ffffff" />}
          />

          <TouchableOpacity
            onPress={onNavigateToRegister}
            style={styles.linkButton}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Нет аккаунта?{" "}
              <Text style={styles.linkHighlight}>Зарегистрироваться</Text>
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.darkest,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "rgba(249, 115, 22, 0.4)",
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  formCard: {
    padding: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: colors.status.error,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
  submitBtn: {
    marginTop: 16,
  },
  linkButton: {
    marginTop: 20,
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  linkHighlight: {
    color: colors.brand.primary,
    fontWeight: "600",
  },
});
