import mongoose, { Schema, Types } from "mongoose";
import bcrypt from "bcryptjs";
import { IUser, IGameScore } from "../types";

interface IPurchasedReader {
  readerId: Types.ObjectId;
  purchasedAt: Date;
  downloadCount: number;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    credits: {
      type: Number,
      default: 100, // Starting credits for new users
      min: 0,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      averageAccuracy: { type: Number, default: 0 },
      averageTime: { type: Number, default: 0 },
      bestScore: { type: Number, default: 0 },
    },
    purchasedReaders: [
      {
        readerId: {
          type: Schema.Types.ObjectId,
          ref: "Reader",
        },
        purchasedAt: {
          type: Date,
          default: Date.now,
        },
        downloadCount: {
          type: Number,
          default: 0,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
userSchema.index({ totalPoints: -1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  // Only hash if password is modified
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update stats method
userSchema.methods.updateStats = function (gameScore: IGameScore): void {
  this.stats.gamesPlayed += 1;
  this.totalPoints += gameScore.points;

  // Update averages
  const totalGames = this.stats.gamesPlayed;
  this.stats.averageAccuracy =
    (this.stats.averageAccuracy * (totalGames - 1) + gameScore.accuracy) /
    totalGames;
  this.stats.averageTime =
    (this.stats.averageTime * (totalGames - 1) + gameScore.timeInSeconds) /
    totalGames;

  if (gameScore.points > this.stats.bestScore) {
    this.stats.bestScore = gameScore.points;
  }
};

// Purchase reader method
userSchema.methods.purchaseReader = async function (
  readerId: Types.ObjectId,
  cost: number
): Promise<IUser> {
  if (this.credits < cost) {
    throw new Error("Insufficient credits");
  }

  this.credits -= cost;
  this.purchasedReaders.push({
    readerId,
    purchasedAt: new Date(),
    downloadCount: 0,
  });

  return this.save();
};

// Check if user owns reader
userSchema.methods.ownsReader = function (readerId: Types.ObjectId): boolean {
  return this.purchasedReaders.some(
    (purchase: IPurchasedReader) =>
      purchase.readerId.toString() === readerId.toString()
  );
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

export const User = mongoose.model<IUser>("User", userSchema);
export default User;
