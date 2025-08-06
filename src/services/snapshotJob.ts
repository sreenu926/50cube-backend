import cron from "node-cron";
import { LeaderboardSnapshot } from "../models/LeaderboardSnapshot";
import { User } from "../models/User";

class SnapshotJobService {
  private isJobRunning = false;

  /**
   * Initialize the daily snapshot job
   * Runs every day at midnight (00:00)
   */
  initializeDailyJob(): void {
    console.log("🕐 Initializing daily leaderboard snapshot job...");

    // Schedule job to run daily at midnight
    cron.schedule(
      "0 0 * * *",
      async () => {
        console.log("🔄 Starting daily leaderboard snapshot job...");
        await this.createDailySnapshot();
      },
      {
        scheduled: true,
        timezone: "UTC",
      }
    );

    // Also run once immediately for testing (optional)
    if (process.env.NODE_ENV === "development") {
      console.log("🔄 Running initial snapshot for development...");
      setTimeout(() => this.createDailySnapshot(), 5000); // 5 seconds delay
    }

    console.log("✅ Daily snapshot job initialized successfully");
  }

  /**
   * Create snapshots for all scopes (global, math, science, english)
   */
  async createDailySnapshot(): Promise<void> {
    if (this.isJobRunning) {
      console.log("⚠️ Snapshot job already running, skipping...");
      return;
    }

    this.isJobRunning = true;
    const snapshotDate = new Date();
    snapshotDate.setHours(0, 0, 0, 0); // Set to midnight

    try {
      console.log(
        `📸 Creating daily snapshots for ${snapshotDate.toISOString()}`
      );

      // Create snapshots for all scopes
      const scopes = ["global", "math", "science", "english"];
      const snapshotPromises = scopes.map((scope) =>
        this.createScopeSnapshot(scope, snapshotDate)
      );

      await Promise.all(snapshotPromises);

      console.log("✅ Daily snapshots created successfully");

      // Clean up old snapshots (keep only last 30 days)
      await this.cleanupOldSnapshots();
    } catch (error) {
      console.error("❌ Error creating daily snapshots:", error);
    } finally {
      this.isJobRunning = false;
    }
  }

  /**
   * Create snapshot for a specific scope
   */
  private async createScopeSnapshot(scope: string, date: Date): Promise<void> {
    try {
      console.log(`📊 Creating ${scope} leaderboard snapshot...`);

      // For demo purposes, create mock snapshot data
      // In production, this would query actual user data
      const mockSnapshot = {
        date,
        scope,
        totalUsers: Math.floor(Math.random() * 1000) + 500,
        topPerformers: this.generateMockTopPerformers(scope),
        averageAccuracy: Math.random() * 20 + 80, // 80-100%
        averagePoints: Math.floor(Math.random() * 500) + 1000,
        totalSubmissions: Math.floor(Math.random() * 5000) + 2000,
      };

      // Check if snapshot already exists for this date and scope
      const existingSnapshot = await LeaderboardSnapshot.findOne({
        date: { $eq: date },
        scope,
      });

      if (existingSnapshot) {
        console.log(
          `⚠️ Snapshot for ${scope} on ${date.toDateString()} already exists, updating...`
        );
        await LeaderboardSnapshot.updateOne(
          { _id: existingSnapshot._id },
          mockSnapshot
        );
      } else {
        await LeaderboardSnapshot.create(mockSnapshot);
      }

      console.log(`✅ ${scope} snapshot created/updated successfully`);
    } catch (error) {
      console.error(`❌ Error creating ${scope} snapshot:`, error);
    }
  }

  /**
   * Generate mock top performers data
   */
  private generateMockTopPerformers(scope: string): any[] {
    const performers = [];
    const baseNames = [
      "SpeedReader99",
      "QuickLearner",
      "StudyMaster",
      "BrainBoost",
      "LearnFast",
      "QuizPro",
      "MathWiz",
      "ScienceGuru",
      "WordMaster",
    ];

    for (let i = 0; i < Math.min(10, baseNames.length); i++) {
      performers.push({
        userId: `mock_user_${i + 1}`,
        username: `${baseNames[i]}_${scope}`,
        email: `${baseNames[i].toLowerCase()}@example.com`,
        totalPoints: Math.floor(Math.random() * 1000) + 2000 - i * 100,
        accuracy: Math.floor(Math.random() * 15) + 85 - i * 2, // Decreasing accuracy
        totalSubmissions: Math.floor(Math.random() * 50) + 20,
        averageTime: Math.floor(Math.random() * 300) + 300 + i * 50, // Increasing time
        lastActive: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ), // Last 7 days
        rank: i + 1,
        subjectRanks: {
          [scope]: i + 1,
          math: Math.floor(Math.random() * 20) + 1,
          science: Math.floor(Math.random() * 20) + 1,
          english: Math.floor(Math.random() * 20) + 1,
        },
      });
    }

    return performers;
  }

  /**
   * Clean up snapshots older than 30 days
   */
  private async cleanupOldSnapshots(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await LeaderboardSnapshot.deleteMany({
        date: { $lt: thirtyDaysAgo },
      });

      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} old snapshots`);
      }
    } catch (error) {
      console.error("❌ Error cleaning up old snapshots:", error);
    }
  }

  /**
   * Manual trigger for creating snapshots (for testing)
   */
  async triggerManualSnapshot(): Promise<void> {
    console.log("🔄 Manual snapshot trigger initiated...");
    await this.createDailySnapshot();
  }

  /**
   * Get snapshot statistics
   */
  async getSnapshotStats(): Promise<any> {
    try {
      const totalSnapshots = await LeaderboardSnapshot.countDocuments();
      const latestSnapshot = await LeaderboardSnapshot.findOne().sort({
        date: -1,
      });
      const oldestSnapshot = await LeaderboardSnapshot.findOne().sort({
        date: 1,
      });

      return {
        totalSnapshots,
        latestDate: latestSnapshot?.date,
        oldestDate: oldestSnapshot?.date,
        scopes: ["global", "math", "science", "english"],
      };
    } catch (error) {
      console.error("❌ Error getting snapshot stats:", error);
      return null;
    }
  }
}

// Export singleton instance
export const snapshotJobService = new SnapshotJobService();
