import { Platform, Alert } from "react-native";

/**
 * Cross-platform alert that works on both native devices (iOS/Android)
 * and web (where Alert.alert is a no-op stub in react-native-web).
 */
export function showAlert(title: string, message?: string, onOk?: () => void): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      try {
        window.alert(message ? `${title}\n\n${message}` : title);
        onOk?.();
      } catch {
        onOk?.();
      }
    } else {
      onOk?.();
    }
  } else {
    Alert.alert(title, message, onOk ? [{ text: "OK", onPress: onOk }] : undefined);
  }
}

/**
 * Cross-platform confirm dialog that works on native devices (iOS/Android)
 * and web (where Alert.alert is a no-op stub in react-native-web).
 */
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      try {
        const confirmed = window.confirm(`${title}\n\n${message}`);
        if (confirmed) {
          onConfirm();
        } else {
          onCancel?.();
        }
      } catch {
        // In case window.confirm is restricted, proceed with action
        onConfirm();
      }
    } else {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: onCancel },
      { text: "Exit / Sign Out", style: "destructive", onPress: onConfirm },
    ]);
  }
}
