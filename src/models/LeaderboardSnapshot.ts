import mongoose, { Document, Schema, Model } from "mongoose";

// Interface for individual user performance in snapshot
interface UserPerformance {
  userId: mongoose.Types.ObjectId;
  username: string;
  email: string;
  totalPoints: number;
  accuracy: number;
  totalSubmissions: number;
  averageTime: number;
  lastActive: Date;
  rank: number;
  subjectRanks?: {
    math?: number;
    science?: number;
    english?: number;
    [key: string]: number | undefined;
  };
}

// Interface for the main leaderboard snapshot document
export interface ILeaderboardSnapshot extends Document {
  date: Date;
  scope: "global" | "math" | "science" | "english";
  totalUsers: number;
  topPerformers: UserPerformance[];
  averageAccuracy: number;
  averagePoints: number;
  totalSubmissions: number;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for static methods
interface ILeaderboardSnapshotStatics {
  getLatestSnapshot(scope: string): Promise<ILeaderboardSnapshot | null>;
  getHistoricalData(
    scope: string,
    days?: number
  ): Promise<ILeaderboardSnapshot[]>;
  getUserRankHistory(
    userId: string,
    scope?: string,
    days?: number
  ): Promise<any[]>;
}

// Combined interface for the model
interface ILeaderboardSnapshotModel
  extends Model<ILeaderboardSnapshot>,
    ILeaderboardSnapshotStatics {}

// Schema for user performance subdocument
const UserPerformanceSchema = new Schema<UserPerformance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    totalPoints: {
      type: Number,
      required: true,
      min: 0,
    },
    accuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    totalSubmissions: {
      type: Number,
      required: true,
      min: 0,
    },
    averageTime: {
      type: Number,
      required: true,
      min: 0,
    },
    lastActive: {
      type: Date,
      required: true,
    },
    rank: {
      type: Number,
      required: true,
      min: 1,
    },
    subjectRanks: {
      math: { type: Number, min: 1 },
      science: { type: Number, min: 1 },
      english: { type: Number, min: 1 },
    },
  },
  { _id: false }
);

// Main leaderboard snapshot schema
const LeaderboardSnapshotSchema = new Schema<ILeaderboardSnapshot>(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: ["global", "math", "science", "english"],
      required: true,
      index: true,
    },
    totalUsers: {
      type: Number,
      required: true,
      min: 0,
    },
    topPerformers: [UserPerformanceSchema],
    averageAccuracy: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    averagePoints: {
      type: Number,
      required: true,
      min: 0,
    },
    totalSubmissions: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
    collection: "leaderboard_snapshots",
  }
);

// Compound index for efficient queries
LeaderboardSnapshotSchema.index({ date: -1, scope: 1 });

// Static method to get latest snapshot for a scope
LeaderboardSnapshotSchema.statics.getLatestSnapshot = async function (
  scope: string
) {
  return this.findOne({ scope })
    .sort({ date: -1 })
    .populate("topPerformers.userId", "username email")
    .lean();
};

// Static method to get historical data for trends
LeaderboardSnapshotSchema.statics.getHistoricalData = async function (
  scope: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    scope,
    date: { $gte: startDate },
  })
    .sort({ date: -1 })
    .select("date totalUsers averageAccuracy averagePoints totalSubmissions")
    .lean();
};

// Static method to get user's rank history
LeaderboardSnapshotSchema.statics.getUserRankHistory = async function (
  userId: string,
  scope: string = "global",
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.find({
    scope,
    date: { $gte: startDate },
    "topPerformers.userId": new mongoose.Types.ObjectId(userId),
  })
    .select("date topPerformers.$")
    .sort({ date: -1 })
    .lean();
};

// Create and export the model with proper typing
export const LeaderboardSnapshot = mongoose.model<
  ILeaderboardSnapshot,
  ILeaderboardSnapshotModel
>("LeaderboardSnapshot", LeaderboardSnapshotSchema);
