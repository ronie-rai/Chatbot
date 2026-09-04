export type RootStackParamList = {
  Login: undefined;
  ConversationList: undefined;
  Admin: undefined;
  Chat: {
    conversationId: string;
    conversationName: string;
  };
};
