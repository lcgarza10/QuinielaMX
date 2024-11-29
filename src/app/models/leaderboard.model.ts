export interface LeaderboardEntry {
  userId: string;
  username: string;
  totalPoints: number;
  weeklyPoints?: number;
  livePoints?: number;
  predictions?: Array<{
    matchId: number;
    homeScore: number;
    awayScore: number;
    points: number;
  }>;
  hasPredicted?: boolean;
}
