export type RootStackParamList = {
  Login: undefined;
  ConversationList: undefined;
  Dashboard: undefined;
  Admin: undefined;
  Chat: {
    conversationId: string;
    conversationName: string;
  };
};
