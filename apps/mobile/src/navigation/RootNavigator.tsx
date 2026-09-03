import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./types";
import { LoginScreen } from "../screens/LoginScreen";
import { ConversationListScreen } from "../screens/ConversationListScreen";
import { ChatScreen } from "../screens/ChatScreen";
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
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params.conversationName })}
      />
    </Stack.Navigator>
  );
}
