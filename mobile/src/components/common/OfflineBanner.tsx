import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStore } from "../../store/useNetworkStore";
import { colors } from "../../theme/colors";

function getWorkoutWord(count: number): string {
  const abs = Math.abs(count) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return "тренировок";
  if (lastDigit > 1 && lastDigit < 5) return "тренировки";
  if (lastDigit === 1) return "тренировка";
  return "тренировок";
}

export const OfflineBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    isOffline,
    reconnectedBannerVisible,
    queueCount,
    isSyncing,
    syncNow,
    dismissReconnectedBanner,
  } = useNetworkStore();

  // If online, no reconnection notice and no queued items, don't occupy any space
  if (!isOffline && !reconnectedBannerVisible && queueCount === 0) {
    return null;
  }

  // RECONNECTED STATE BANNER
  if (reconnectedBannerVisible && !isOffline) {
    return (
      <View
        style={[
          styles.container,
          styles.reconnectedContainer,
          { paddingTop: Math.max(insets.top, 8) + 4 },
        ]}
      >
        <View style={styles.contentRow}>
          <View style={styles.leftGroup}>
            <View style={styles.iconCircleSuccess}>
              <Wifi size={14} color={colors.status.success} />
            </View>
            <Text style={styles.reconnectedText}>Связь восстановлена</Text>
          </View>
          <TouchableOpacity
            onPress={dismissReconnectedBanner}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={15} color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // OFFLINE STATE BANNER
  if (isOffline) {
    return (
      <View
        style={[
          styles.container,
          styles.offlineContainer,
          { paddingTop: Math.max(insets.top, 8) + 4 },
        ]}
      >
        <View style={styles.contentRow}>
          <View style={styles.leftGroup}>
            <View style={styles.iconCircleWarning}>
              <WifiOff size={14} color={colors.brand.primary} />
            </View>
            <View style={styles.textColumn}>
              <Text style={styles.offlineTitle}>
                Офлайн-режим — данные сохраняются локально
              </Text>
              {queueCount > 0 && (
                <Text style={styles.queueSubtext}>
                  В очереди: {queueCount} {getWorkoutWord(queueCount)}
                </Text>
              )}
            </View>
          </View>

          {queueCount > 0 && (
            <TouchableOpacity
              onPress={() => syncNow()}
              disabled={isSyncing}
              style={[styles.syncBtn, isSyncing && styles.syncBtnDisabled]}
              activeOpacity={0.7}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <RefreshCw size={12} color="#ffffff" style={styles.syncBtnIcon} />
                  <Text style={styles.syncBtnText}>Синхр.</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // PENDING SYNC QUEUE BANNER (Online, but unsent workouts remain in queue)
  if (queueCount > 0) {
    return (
      <View
        style={[
          styles.container,
          styles.pendingContainer,
          { paddingTop: Math.max(insets.top, 8) + 4 },
        ]}
      >
        <View style={styles.contentRow}>
          <View style={styles.leftGroup}>
            <View style={styles.iconCircleInfo}>
              <AlertTriangle size={14} color={colors.brand.light} />
            </View>
            <View style={styles.textColumn}>
              <Text style={styles.pendingTitle}>
                В очереди: {queueCount} {getWorkoutWord(queueCount)}
              </Text>
              <Text style={styles.pendingSubtext}>Ожидает отправки на сервер</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => syncNow()}
            disabled={isSyncing}
            style={[styles.syncBtn, isSyncing && styles.syncBtnDisabled]}
            activeOpacity={0.7}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <RefreshCw size={12} color="#ffffff" style={styles.syncBtnIcon} />
                <Text style={styles.syncBtnText}>Синхронизировать сейчас</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    zIndex: 999,
  },
  offlineContainer: {
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    borderBottomColor: "rgba(249, 115, 22, 0.3)",
  },
  reconnectedContainer: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderBottomColor: "rgba(34, 197, 94, 0.3)",
  },
  pendingContainer: {
    backgroundColor: "rgba(39, 39, 42, 0.9)",
    borderBottomColor: colors.border.subtle,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  textColumn: {
    flex: 1,
  },
  iconCircleWarning: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(249, 115, 22, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconCircleSuccess: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  iconCircleInfo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(253, 186, 116, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  offlineTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand.primary,
  },
  queueSubtext: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  reconnectedText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.status.success,
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.primary,
  },
  pendingSubtext: {
    fontSize: 11,
    color: colors.text.muted,
  },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  syncBtnDisabled: {
    opacity: 0.6,
  },
  syncBtnIcon: {
    marginRight: 4,
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  closeBtn: {
    padding: 4,
  },
});
