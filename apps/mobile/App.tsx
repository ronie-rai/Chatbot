import React, { useEffect, useRef } from "react";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import {
  registerForPushNotificationsAsync,
  addForegroundNotificationListener,
  addNotificationResponseListener,
} from "./src/services/notifications";
import type { RootStackParamList } from "./src/navigation/types";

export default function App(): React.ReactElement {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    // Register for push notifications on mount
    registerForPushNotificationsAsync().catch(console.error);

    // Listen for notifications received in foreground (already shown by handler)
    const foregroundSub = addForegroundNotificationListener((notification) => {
      console.log("[push] Foreground notification:", notification.request.content.title);
    });

    // Navigate when user taps a notification
    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (!navigationRef.current) return;
      if (data?.type === "message" && data?.conversationId) {
        navigationRef.current.navigate("Chat", {
          conversationId: data.conversationId,
          conversationName: "OFA Assistant",
        });
      } else if (data?.type === "form_submission" || data?.type === "booking_reminder") {
        navigationRef.current.navigate("Dashboard");
      }
    });

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider style={styles.container}>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
