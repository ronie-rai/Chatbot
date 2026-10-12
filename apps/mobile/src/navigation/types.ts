export type RootStackParamList = {
  Login: undefined;
  ConversationList: undefined;
  Dashboard: undefined;
  Admin: undefined;
  Academy: undefined;
  AcademyPlayers: { initialTab?: "players" | "sports" } | undefined;
  AcademyAttendance: undefined;
  AcademyGrowth: undefined;
  AcademyFinance: undefined;
  AcademyBookings: undefined;
  AcademyAnnouncements: undefined;
  AcademyReports: undefined;
  Chat: {
    conversationId: string;
    conversationName: string;
  };
};

