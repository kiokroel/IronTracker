import { ArrowLeft, Dumbbell, UserPlus } from "lucide-react-native";
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

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onNavigateToLogin,
}) => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { register, isLoading, error, clearError } = useAuthStore();

  const handleRegister = async () => {
    setValidationError(null);
    if (!email.trim() || !username.trim() || !password.trim()) {
      setValidationError("Заполните все обязательные поля");
      return;
    }

    if (password.length < 6) {
      setValidationError("Пароль должен содержать не менее 6 символов");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Введенные пароли не совпадают");
      return;
    }

    try {
      await register({
        email: email.trim(),
        username: username.trim(),
        password,
      });
    } catch {
      // Error is stored in store
    }
  };

  const activeError = validationError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "android" ? "height" : "padding"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          onPress={onNavigateToLogin}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text.secondary} />
          <Text style={styles.backText}>Назад ко входу</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Dumbbell size={36} color={colors.brand.primary} />
          </View>
          <Text style={styles.brandTitle}>Регистрация</Text>
          <Text style={styles.subtitle}>
            Создайте профиль атлета и присоединяйтесь к лидерборду
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Новый аккаунт</Text>

          {activeError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{activeError}</Text>
            </View>
          )}

          <Input
            label="Email"
            placeholder="athlete@example.com"
            value={email}
            onChangeText={(val) => {
              if (error) clearError();
              setValidationError(null);
              setEmail(val);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Input
            label="Имя атлета (Username)"
            placeholder="IronLifter"
            value={username}
            onChangeText={(val) => {
              if (error) clearError();
              setValidationError(null);
              setUsername(val);
            }}
            autoCapitalize="none"
          />

          <Input
            label="Пароль"
            placeholder="Минимум 6 символов"
            value={password}
            onChangeText={(val) => {
              if (error) clearError();
              setValidationError(null);
              setPassword(val);
            }}
            secureTextEntry
            autoCapitalize="none"
          />

          <Input
            label="Подтверждение пароля"
            placeholder="Повторите пароль"
            value={confirmPassword}
            onChangeText={(val) => {
              setValidationError(null);
              setConfirmPassword(val);
            }}
            secureTextEntry
            autoCapitalize="none"
          />

          <Button
            title="Зарегистрироваться"
            onPress={handleRegister}
            loading={isLoading}
            disabled={!email || !username || !password || isLoading}
            style={styles.submitBtn}
            icon={<UserPlus size={18} color="#ffffff" />}
          />

          <TouchableOpacity
            onPress={onNavigateToLogin}
            style={styles.linkButton}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Уже есть аккаунт? <Text style={styles.linkHighlight}>Войти</Text>
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
    padding: 20,
    paddingTop: 40,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backText: {
    color: colors.text.secondary,
    fontSize: 14,
    marginLeft: 6,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "rgba(249, 115, 22, 0.4)",
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 20,
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
    marginTop: 18,
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
