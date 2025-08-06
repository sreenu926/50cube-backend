import { Document, Types } from "mongoose";

// User related interfaces
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  credits: number;
  totalPoints: number;
  stats: {
    gamesPlayed: number;
    averageAccuracy: number;
    averageTime: number;
    bestScore: number;
  };
  purchasedReaders: Array<{
    readerId: Types.ObjectId;
    purchasedAt: Date;
    downloadCount: number;
  }>;
  isActive: boolean;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  updateStats(gameScore: IGameScore): void;
  purchaseReader(readerId: Types.ObjectId, cost: number): Promise<IUser>;
  ownsReader(readerId: Types.ObjectId): boolean;
}

// League related interfaces
export interface ILeague extends Document {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  maxParticipants: number;
  entryFee: number;
  prizes: Array<{
    rank: number;
    description: string;
    credits: number;
    badge?: string;
  }>;
  rules: {
    scoringMethod: "accuracy_then_time" | "time_then_accuracy" | "points_only";
    maxSubmissions: number;
    skillLevel: "beginner" | "intermediate" | "advanced" | "expert";
  };
  participants: Array<{
    userId: Types.ObjectId;
    username: string;
    joinedAt: Date;
    submissions: Array<IGameScore>;
    bestSubmission: IGameScore;
    currentRank?: number;
  }>;
  status: "upcoming" | "active" | "completed" | "cancelled";
  category: "math" | "science" | "language" | "general" | "mixed";
  isPublic: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Virtual properties
  participantCount: number;
  spotsRemaining: number;
  durationInDays: number;

  // Methods
  addParticipant(userId: Types.ObjectId, username: string): Promise<ILeague>;
  submitScore(userId: Types.ObjectId, scoreData: IGameScore): Promise<ILeague>;
  isBetterScore(newScore: IGameScore, currentBest: IGameScore): boolean;
  getLeaderboard(): Array<ILeaderboardEntry>;
}

// Reader related interfaces
export interface IReader extends Document {
  title: string;
  description: string;
  author: string;
  category:
    | "math"
    | "science"
    | "language"
    | "history"
    | "general"
    | "technology"
    | "business";
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  pages: number;
  price: number;
  originalPrice?: number;
  tags: string[];
  thumbnail?: string;
  filePath: string;
  fileSize: number;
  previewPages: number;
  ratings: {
    average: number;
    count: number;
    breakdown: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
  downloads: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  publishedAt: Date;
  metadata: {
    isbn?: string;
    publisher?: string;
    publicationYear?: number;
    language: string;
    keywords: string[];
  };
  salesStats: {
    totalSales: number;
    revenue: number;
    last30Days: number;
  };
  createdAt: Date;
  updatedAt: Date;

  // Virtual properties
  formattedFileSize: string;
  discountPercentage: number;
  popularityScore: number;

  // Methods
  generateDownloadToken(
    userId: Types.ObjectId,
    expiresIn?: number
  ): IDownloadToken;
  recordDownload(): Promise<IReader>;
  addRating(rating: number): Promise<IReader>;
}

// Common interfaces
export interface IGameScore {
  accuracy: number;
  timeInSeconds: number;
  points: number;
  submittedAt?: Date;
  gameData?: {
    questionsAnswered?: number;
    correctAnswers?: number;
    gameMode?: string;
    difficulty?: string;
  };
}

export interface ILeaderboardEntry {
  rank: number;
  userId: Types.ObjectId;
  username: string;
  accuracy: number;
  timeInSeconds: number;
  points: number;
  submittedAt?: Date;
  submissions?: number;
}

export interface IDownloadToken {
  token: string;
  expires: number;
  downloadUrl: string;
}

// API Response interfaces
export interface IApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface IPaginationResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Request interfaces
export interface IAuthRequest extends Request {
  userId?: Types.ObjectId;
  user?: IUser;
}

// Environment variables
export interface IEnvironmentVariables {
  MONGODB_URI: string;
  JWT_SECRET: string;
  PORT: string;
  NODE_ENV: "development" | "production" | "test";
}
