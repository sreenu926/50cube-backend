import cron from "node-cron";
import { LeaderboardSnapshot } from "../models/LeaderboardSnapshot";
import { League } from "../models/League";
import { User } from "../models/User";

export class SnapshotJobService {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  // Initialize the daily snapshot job
  public initializeDailyJob() {
    // Run daily at 2:00 AM UTC to avoid peak usage times
    this.cronJob = cron.schedule(
      "0 2 * * *",
      async () => {
        console.log(
          "🕐 Daily snapshot job started at:",
          new Date().toISOString()
        );
        await this.executeDailySnapshotCreation();
      },
      {
        scheduled: false, // Don't start immediately
        timezone: "UTC",
      }
    );

    console.log(
      "📅 Daily snapshot job initialized (runs at 2:00 AM UTC daily)"
    );
  }

  // Start the cron job
  public startJob() {
    if (this.cronJob) {
      this.cronJob.start();
      console.log("✅ Daily snapshot job started");
    }
  }

  // Stop the cron job
  public stopJob() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log("❌ Daily snapshot job stopped");
    }
  }

  // Manual trigger for snapshot creation (useful for testing)
  public async triggerManualSnapshot() {
    if (this.isRunning) {
      console.log("⚠️  Snapshot job already running, skipping manual trigger");
      return;
    }

    console.log("🔧 Manual snapshot trigger initiated");
    await this.executeDailySnapshotCreation();
  }

  // Main execution logic for creating daily snapshots
  private async executeDailySnapshotCreation() {
    if (this.isRunning) {
      console.log("⚠️  Snapshot job already running, skipping execution");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day

      console.log(`📊 Creating snapshots for date: ${today.toISOString()}`);

      // Create snapshots for all scopes
      const scopes = ["global", "math", "science", "english"];
      const results = [];

      for (const scope of scopes) {
        try {
          console.log(`  📈 Processing ${scope} leaderboard...`);

          // Check if snapshot already exists for today
          const existingSnapshot = await LeaderboardSnapshot.findOne({
            date: today,
            scope: scope,
          });

          if (existingSnapshot) {
            console.log(
              `  ⏭️  Snapshot for ${scope} already exists, updating...`
            );
            const updatedSnapshot = await this.updateExistingSnapshot(
              existingSnapshot,
              scope
            );
            results.push({
              scope,
              action: "updated",
              snapshot: updatedSnapshot,
            });
          } else {
            console.log(`  ✨ Creating new snapshot for ${scope}...`);
            const newSnapshot = await this.createNewSnapshot(today, scope);
            results.push({ scope, action: "created", snapshot: newSnapshot });
          }
        } catch (scopeError: any) {
          console.error(`❌ Error processing ${scope} snapshot:`, scopeError);
          results.push({ scope, action: "failed", error: scopeError.message });
        }
      }

      // Clean up old snapshots (keep only last 90 days)
      await this.cleanupOldSnapshots();

      const duration = Date.now() - startTime;
      console.log(`✅ Daily snapshot job completed in ${duration}ms`);
      console.log(
        "📊 Results summary:",
        results.map((r) => `${r.scope}: ${r.action}`).join(", ")
      );

      return results;
    } catch (error) {
      console.error("❌ Daily snapshot job failed:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  // Create a new snapshot for a given scope
  private async createNewSnapshot(date: Date, scope: string) {
    const leaderboardData = await this.generateLeaderboardData(scope);

    const snapshot = new LeaderboardSnapshot({
      date,
      scope,
      totalUsers: leaderboardData.totalUsers,
      topPerformers: leaderboardData.topPerformers,
      averageAccuracy: leaderboardData.averageAccuracy,
      averagePoints: leaderboardData.averagePoints,
      totalSubmissions: leaderboardData.totalSubmissions,
    });

    await snapshot.save();
    console.log(
      `  ✅ Created ${scope} snapshot with ${leaderboardData.totalUsers} users`
    );
    return snapshot;
  }

  // Update an existing snapshot
  private async updateExistingSnapshot(existingSnapshot: any, scope: string) {
    const leaderboardData = await this.generateLeaderboardData(scope);

    existingSnapshot.totalUsers = leaderboardData.totalUsers;
    existingSnapshot.topPerformers = leaderboardData.topPerformers;
    existingSnapshot.averageAccuracy = leaderboardData.averageAccuracy;
    existingSnapshot.averagePoints = leaderboardData.averagePoints;
    existingSnapshot.totalSubmissions = leaderboardData.totalSubmissions;
    existingSnapshot.updatedAt = new Date();

    await existingSnapshot.save();
    console.log(
      `  🔄 Updated ${scope} snapshot with ${leaderboardData.totalUsers} users`
    );
    return existingSnapshot;
  }

  // Generate leaderboard data by aggregating from leagues
  private async generateLeaderboardData(scope: string) {
    console.log(`    🔍 Aggregating data for ${scope} scope...`);

    // Build match conditions based on scope
    const matchConditions: any = {
      status: "active", // Only include active leagues
    };

    if (scope !== "global") {
      matchConditions.subject = scope;
    }

    // Aggregation pipeline to calculate user performance
    const pipeline: any[] = [
      { $match: matchConditions },
      { $unwind: "$participants" },
      {
        $lookup: {
          from: "users",
          localField: "participants.userId",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $group: {
          _id: "$participants.userId",
          username: { $first: "$userInfo.username" },
          email: { $first: "$userInfo.email" },
          totalPoints: { $sum: "$participants.bestScore.points" },
          totalSubmissions: { $sum: "$participants.submissionCount" },
          accuracySum: { $sum: "$participants.bestScore.accuracy" },
          timeSum: { $sum: "$participants.bestScore.timeInSeconds" },
          leagueCount: { $sum: 1 },
          lastActive: { $max: "$participants.lastSubmission" },
        },
      },
      {
        $addFields: {
          averageAccuracy: {
            $divide: ["$accuracySum", "$leagueCount"],
          },
          averageTime: {
            $divide: ["$timeSum", "$leagueCount"],
          },
        },
      },
      {
        $sort: {
          totalPoints: -1,
          averageAccuracy: -1,
          averageTime: 1,
        },
      },
      { $limit: 100 }, // Top 100 users for the snapshot
    ];

    const aggregatedUsers = await League.aggregate(pipeline);
    console.log(
      `    📊 Found ${aggregatedUsers.length} active users for ${scope}`
    );

    // Process and rank the users - FIXED: Process subject ranks separately for global scope
    const topPerformers = [];

    for (let index = 0; index < aggregatedUsers.length; index++) {
      const user = aggregatedUsers[index];

      const performerData = {
        userId: user._id,
        username: user.username,
        email: user.email,
        totalPoints: Math.round(user.totalPoints || 0),
        accuracy: Math.round(user.averageAccuracy || 0),
        totalSubmissions: user.totalSubmissions || 0,
        averageTime: Math.round(user.averageTime || 0),
        lastActive: user.lastActive || new Date(),
        rank: index + 1,
        // Add subject-specific ranks if this is global scope
        ...(scope === "global" && {
          subjectRanks: await this.calculateSubjectRanks(user._id),
        }),
      };

      topPerformers.push(performerData);
    }

    // Calculate aggregate statistics
    const totalUsers = topPerformers.length;
    const averageAccuracy =
      totalUsers > 0
        ? Math.round(
            topPerformers.reduce((sum, user) => sum + user.accuracy, 0) /
              totalUsers
          )
        : 0;
    const averagePoints =
      totalUsers > 0
        ? Math.round(
            topPerformers.reduce((sum, user) => sum + user.totalPoints, 0) /
              totalUsers
          )
        : 0;
    const totalSubmissions = topPerformers.reduce(
      (sum, user) => sum + user.totalSubmissions,
      0
    );

    console.log(
      `    📈 Stats: ${totalUsers} users, ${averageAccuracy}% avg accuracy, ${averagePoints} avg points`
    );

    return {
      totalUsers,
      topPerformers,
      averageAccuracy,
      averagePoints,
      totalSubmissions,
    };
  }

  // Calculate subject-specific ranks for a user (used in global scope)
  private async calculateSubjectRanks(userId: any) {
    const subjects = ["math", "science", "english"];
    const subjectRanks: any = {};

    for (const subject of subjects) {
      try {
        // Get user's rank in this subject
        const pipeline: any[] = [
          { $match: { subject, status: "active" } },
          { $unwind: "$participants" },
          {
            $group: {
              _id: "$participants.userId",
              totalPoints: { $sum: "$participants.bestScore.points" },
              averageAccuracy: { $avg: "$participants.bestScore.accuracy" },
            },
          },
          {
            $sort: {
              totalPoints: -1,
              averageAccuracy: -1,
            },
          },
        ];

        const subjectLeaderboard = await League.aggregate(pipeline);
        const userIndex = subjectLeaderboard.findIndex(
          (u: any) => u._id.toString() === userId.toString()
        );

        if (userIndex !== -1) {
          subjectRanks[subject] = userIndex + 1;
        }
      } catch (error) {
        console.error(
          `Error calculating ${subject} rank for user ${userId}:`,
          error
        );
      }
    }

    return subjectRanks;
  }

  // Clean up snapshots older than 90 days
  private async cleanupOldSnapshots() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    try {
      const result = await LeaderboardSnapshot.deleteMany({
        date: { $lt: cutoffDate },
      });

      if (result.deletedCount && result.deletedCount > 0) {
        console.log(
          `🧹 Cleaned up ${result.deletedCount} old snapshots (older than 90 days)`
        );
      }
    } catch (error) {
      console.error("❌ Error during snapshot cleanup:", error);
    }
  }

  // Get job status - FIXED: Removed non-existent properties
  public getJobStatus() {
    return {
      isInitialized: !!this.cronJob,
      isRunning: this.isRunning,
      isScheduled: this.cronJob !== null,
      nextRun: null, // Cron job doesn't expose nextDate in this version
    };
  }

  // Get recent snapshot statistics
  public async getSnapshotStats() {
    try {
      const stats = await LeaderboardSnapshot.aggregate([
        {
          $group: {
            _id: "$scope",
            totalSnapshots: { $sum: 1 },
            latestDate: { $max: "$date" },
            avgUsers: { $avg: "$totalUsers" },
            avgAccuracy: { $avg: "$averageAccuracy" },
          },
        },
      ]);

      return stats.reduce((acc: any, stat: any) => {
        acc[stat._id] = {
          totalSnapshots: stat.totalSnapshots,
          latestDate: stat.latestDate,
          avgUsers: Math.round(stat.avgUsers || 0),
          avgAccuracy: Math.round(stat.avgAccuracy || 0),
        };
        return acc;
      }, {});
    } catch (error) {
      console.error("Error fetching snapshot stats:", error);
      return {};
    }
  }
}

// Export singleton instance
export const snapshotJobService = new SnapshotJobService();
