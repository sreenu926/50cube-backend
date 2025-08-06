import mongoose, { Schema, Types } from "mongoose";
import { ILeague, IGameScore, ILeaderboardEntry } from "../types";

interface ILeagueParticipant {
  userId: Types.ObjectId;
  username: string;
  joinedAt: Date;
  submissions: IGameScore[];
  bestSubmission: IGameScore;
  currentRank?: number;
}

const gameScoreSchema = new Schema<IGameScore>({
  accuracy: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  timeInSeconds: {
    type: Number,
    required: true,
    min: 0,
  },
  points: {
    type: Number,
    required: true,
    min: 0,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  gameData: {
    questionsAnswered: { type: Number },
    correctAnswers: { type: Number },
    gameMode: { type: String },
    difficulty: { type: String },
  },
});

const leagueParticipantSchema = new Schema<ILeagueParticipant>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  submissions: [gameScoreSchema],
  bestSubmission: {
    type: gameScoreSchema,
    default: () => ({
      accuracy: 0,
      timeInSeconds: 0,
      points: 0,
      submittedAt: new Date(),
    }),
  },
  currentRank: {
    type: Number,
    default: null,
  },
});

const leagueSchema = new Schema<ILeague>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    maxParticipants: {
      type: Number,
      default: 1000,
    },
    entryFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    prizes: [
      {
        rank: Number,
        description: String,
        credits: { type: Number, default: 0 },
        badge: String,
      },
    ],
    rules: {
      scoringMethod: {
        type: String,
        enum: ["accuracy_then_time", "time_then_accuracy", "points_only"],
        default: "accuracy_then_time",
      },
      maxSubmissions: {
        type: Number,
        default: 3,
      },
      skillLevel: {
        type: String,
        enum: ["beginner", "intermediate", "advanced", "expert"],
        default: "intermediate",
      },
    },
    participants: [leagueParticipantSchema],
    status: {
      type: String,
      enum: ["upcoming", "active", "completed", "cancelled"],
      default: "upcoming",
    },
    category: {
      type: String,
      enum: ["math", "science", "language", "general", "mixed"],
      default: "general",
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for participant count
leagueSchema.virtual("participantCount").get(function () {
  return this.participants.length;
});

// Virtual for spots remaining
leagueSchema.virtual("spotsRemaining").get(function () {
  return this.maxParticipants - this.participants.length;
});

// Virtual for league duration
leagueSchema.virtual("durationInDays").get(function () {
  const diffTime = Math.abs(this.endDate.getTime() - this.startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Indexes for performance
leagueSchema.index({ status: 1, startDate: 1 });
leagueSchema.index({ endDate: 1 });
leagueSchema.index({ category: 1 });
leagueSchema.index({ "participants.userId": 1 });

// Middleware to update status based on dates
leagueSchema.pre("save", function (next) {
  const now = new Date();

  if (this.startDate > now && this.status === "upcoming") {
    // Keep as upcoming
  } else if (
    this.startDate <= now &&
    this.endDate > now &&
    this.status !== "completed"
  ) {
    this.status = "active";
  } else if (this.endDate <= now && this.status !== "completed") {
    this.status = "completed";
  }

  next();
});

// Method to join league
leagueSchema.methods.addParticipant = async function (
  userId: Types.ObjectId,
  username: string
): Promise<ILeague> {
  // Check if user already joined
  const existingParticipant = this.participants.find(
    (p: ILeagueParticipant) => p.userId.toString() === userId.toString()
  );

  if (existingParticipant) {
    throw new Error("User already joined this league");
  }

  // Check if league is full
  if (this.participants.length >= this.maxParticipants) {
    throw new Error("League is full");
  }

  // Check if league is active or upcoming
  if (this.status !== "active" && this.status !== "upcoming") {
    throw new Error("Cannot join league at this time");
  }

  this.participants.push({
    userId,
    username,
    joinedAt: new Date(),
    submissions: [],
    bestSubmission: {
      accuracy: 0,
      timeInSeconds: 0,
      points: 0,
      submittedAt: new Date(),
    },
  });

  return this.save();
};

// Method to submit score
leagueSchema.methods.submitScore = async function (
  userId: Types.ObjectId,
  scoreData: IGameScore
): Promise<ILeague> {
  const participant = this.participants.find(
    (p: ILeagueParticipant) => p.userId.toString() === userId.toString()
  );

  if (!participant) {
    throw new Error("User not found in league");
  }

  // Check submission limit
  if (participant.submissions.length >= this.rules.maxSubmissions) {
    throw new Error("Maximum submissions reached");
  }

  // Check if league is active
  if (this.status !== "active") {
    throw new Error("League is not active");
  }

  // Add submission
  participant.submissions.push({
    ...scoreData,
    submittedAt: new Date(),
  });

  // Update best submission if this is better
  if (
    !participant.bestSubmission.points ||
    this.isBetterScore(scoreData, participant.bestSubmission)
  ) {
    participant.bestSubmission = {
      ...scoreData,
      submittedAt: new Date(),
    };
  }

  return this.save();
};

// Method to compare scores based on league rules
leagueSchema.methods.isBetterScore = function (
  newScore: IGameScore,
  currentBest: IGameScore
): boolean {
  switch (this.rules.scoringMethod) {
    case "accuracy_then_time":
      if (newScore.accuracy > currentBest.accuracy) return true;
      if (
        newScore.accuracy === currentBest.accuracy &&
        newScore.timeInSeconds < currentBest.timeInSeconds
      )
        return true;
      return false;

    case "time_then_accuracy":
      if (newScore.timeInSeconds < currentBest.timeInSeconds) return true;
      if (
        newScore.timeInSeconds === currentBest.timeInSeconds &&
        newScore.accuracy > currentBest.accuracy
      )
        return true;
      return false;

    case "points_only":
    default:
      return newScore.points > currentBest.points;
  }
};

// Method to get sorted leaderboard
leagueSchema.methods.getLeaderboard = function (): ILeaderboardEntry[] {
  const participants = this.participants
    .filter((p: ILeagueParticipant) => p.bestSubmission.points > 0)
    .map((p: ILeagueParticipant) => ({
      userId: p.userId,
      username: p.username,
      accuracy: p.bestSubmission.accuracy,
      timeInSeconds: p.bestSubmission.timeInSeconds,
      points: p.bestSubmission.points,
      submittedAt: p.bestSubmission.submittedAt,
      submissions: p.submissions.length,
      rank: 0, // Will be set after sorting
    }));

  // Sort based on league rules - Fixed TypeScript errors
  participants.sort((a: ILeaderboardEntry, b: ILeaderboardEntry) => {
    switch (this.rules.scoringMethod) {
      case "accuracy_then_time":
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        return a.timeInSeconds - b.timeInSeconds;

      case "time_then_accuracy":
        if (a.timeInSeconds !== b.timeInSeconds)
          return a.timeInSeconds - b.timeInSeconds;
        return b.accuracy - a.accuracy;

      case "points_only":
      default:
        return b.points - a.points;
    }
  });

  // Add ranks - Fixed TypeScript errors
  participants.forEach((participant: ILeaderboardEntry, index: number) => {
    participant.rank = index + 1;
  });

  return participants;
};

export const League = mongoose.model<ILeague>("League", leagueSchema);
export default League;
