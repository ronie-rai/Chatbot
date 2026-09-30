/**
 * Push Notification Service for OFA Assistant
 * Handles: Expo push token registration, local notifications,
 * and socket-driven remote notifications for messages, form submissions & bookings.
 */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register for push notifications and return the Expo push token.
 * Only works on real physical devices (not simulator).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[push] Skipping push registration on simulator/emulator");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[push] Push notification permission not granted");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  try {
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    console.log("[push] Expo push token:", token.data);

    // Android channel for custom sound/importance
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("ofa-default", {
        name: "OFA Assistant",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#25D366",
        sound: "default",
      });
      await Notifications.setNotificationChannelAsync("ofa-forms", {
        name: "Form Submissions",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 100, 50, 100],
        lightColor: "#00A884",
        sound: "default",
      });
      await Notifications.setNotificationChannelAsync("ofa-bookings", {
        name: "Upcoming Bookings",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200],
        lightColor: "#075E54",
        sound: "default",
      });
    }

    return token.data;
  } catch (e) {
    console.error("[push] Failed to get push token:", e);
    return null;
  }
}

// ─── Local Notification Helpers ────────────────────────────────────────────

/**
 * Show a local push notification for a new incoming chat message.
 */
export async function showNewMessageNotification(opts: {
  senderName: string;
  messageText: string;
  conversationId: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `💬 ${opts.senderName}`,
      body: opts.messageText.length > 80
        ? opts.messageText.slice(0, 77) + "..."
        : opts.messageText,
      data: { type: "message", conversationId: opts.conversationId },
      sound: "default",
      ...(Platform.OS === "android" && { channelId: "ofa-default" }),
    },
    trigger: null, // immediate
  });
}

/**
 * Show a local push notification when a form/template is submitted.
 */
export async function showFormSubmissionNotification(opts: {
  templateName: string;
  submitterName: string;
  ref: string;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `📋 New Submission: ${opts.templateName}`,
      body: `${opts.submitterName} submitted ${opts.ref}`,
      data: { type: "form_submission", ref: opts.ref },
      sound: "default",
      ...(Platform.OS === "android" && { channelId: "ofa-forms" }),
    },
    trigger: null,
  });
}

/**
 * Show a local push notification for an upcoming booking reminder.
 */
export async function showBookingReminderNotification(opts: {
  bookingRef: string;
  customerName: string;
  sport: string;
  timeSlot: string;
  minutesBefore: number;
}) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🏟️ Upcoming Booking — ${opts.sport}`,
      body: `${opts.customerName} at ${opts.timeSlot} (in ${opts.minutesBefore} min)`,
      data: { type: "booking_reminder", ref: opts.bookingRef },
      sound: "default",
      ...(Platform.OS === "android" && { channelId: "ofa-bookings" }),
    },
    trigger: null,
  });
}

/**
 * Cancel all pending scheduled notifications.
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export type NotificationListener = ReturnType<
  typeof Notifications.addNotificationReceivedListener
>;

/**
 * Add listener for notifications received while app is in foreground.
 * Returns the subscription; caller must call .remove() on unmount.
 */
export function addForegroundNotificationListener(
  handler: (notification: Notifications.Notification) => void
): NotificationListener {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Add listener for when user taps a notification.
 * Returns the subscription; caller must call .remove() on unmount.
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): ReturnType<typeof Notifications.addNotificationResponseReceivedListener> {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
