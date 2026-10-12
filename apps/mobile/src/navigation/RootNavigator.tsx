import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types";
import { LoginScreen } from "../screens/LoginScreen";
import { ConversationListScreen } from "../screens/ConversationListScreen";
import { ChatScreen } from "../screens/ChatScreen";
import { AdminScreen } from "../screens/AdminScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { AcademyHomeScreen } from "../screens/AcademyHomeScreen";
import { PlayerDirectoryScreen } from "../academy/screens/PlayerDirectoryScreen";
import { AttendanceScreen } from "../academy/screens/AttendanceScreen";
import { GrowthScreen } from "../academy/screens/GrowthScreen";
import { FinanceScreen } from "../academy/screens/FinanceScreen";
import { BookingsScreen } from "../academy/screens/BookingsScreen";
import { AnnouncementsScreen } from "../academy/screens/AnnouncementsScreen";
import { ReportsScreen } from "../academy/screens/ReportsScreen";
import { Colors, Fonts } from "../theme/tokens";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerStyle: { backgroundColor: Colors.headerBackground },
        headerTintColor: Colors.textLight,
        headerTitleStyle: { fontWeight: "700", fontSize: Fonts.sizes.lg },
        headerShadowVisible: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{ title: "OFA Chatbot", headerBackVisible: false }}
      />
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Analytics & Data Hub", headerBackVisible: true }}
      />
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{ title: "Admin Portal", headerBackVisible: true }}
      />
      <Stack.Screen
        name="Academy"
        component={AcademyHomeScreen}
        options={{ title: "Sports Academy", headerBackVisible: true }}
      />
      <Stack.Screen
        name="AcademyPlayers"
        component={PlayerDirectoryScreen}
        options={{ title: "Players & Admissions", headerBackVisible: true }}
      />
      <Stack.Screen
        name="AcademyAttendance"
        component={AttendanceScreen}
        options={{ title: "Session Attendance", headerBackVisible: true }}
      />
      <Stack.Screen
        name="AcademyGrowth"
        component={GrowthScreen}
        options={{ title: "Growth & Skill Tracking", headerBackVisible: true }}
      />
      <Stack.Screen
        name="AcademyFinance"
        component={FinanceScreen}
        options={{ title: "Fees & Invoices", headerBackVisible: true }}
      />
      <Stack.Screen
        name="AcademyBookings"
        component={BookingsScreen}
        options={{ title: "Courts & Bookings", headerBackVisible: true }}
      />
      <Stack.Screen
        name="AcademyAnnouncements"
        component={AnnouncementsScreen}
        options={{ title: "Announcements", headerBackVisible: true }}
      />
      <Stack.Screen
        name="AcademyReports"
        component={ReportsScreen}
        options={{ title: "Academy Reports", headerBackVisible: true }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params.conversationName })}
      />
    </Stack.Navigator>
  );
}
