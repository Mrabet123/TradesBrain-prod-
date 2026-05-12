export interface Message {
  id: string;
  sessionId: string;
  createdAt: string;
  role: 'user' | 'assistant';
  contentText: string | null;
  photoUrl: string | null;
  transcriptOriginal: string | null;
  transcriptEdited: string | null;
  modelUsed: string | null;
  sessionStage: number | null;
  isSummary: boolean;
  tokensUsed: number | null;
}

export interface JobSession {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  status: 'active' | 'completed' | 'reopened';
  jobName: string | null;
  jobsite: string | null;
  tradeType: string;
  sessionSource: 'rex' | 'report_standalone' | 'quote_standalone';
  messageCount: number;
  timeOnJobsiteSeconds: number | null;
  parentSessionId: string | null;
}
