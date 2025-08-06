import express from "express";
import Joi from "joi";
import { LeaderboardSnapshot } from "../models/LeaderboardSnapshot";
import { League } from "../models/League";
import { User } from "../models/User";
import { auth } from "../middleware/auth";
import { validate } from "../middleware/validation";

const router = express.Router();

// Validation schemas
const leaderboardQuerySchema = Joi.object({
  scope: Joi.string()
    .valid("global", "math", "science", "english")
    .default("global"),
  limit: Joi.number().integer().min(1).max(100).default(50),
  page: Joi.number().integer().min(1).default(1),
  timeframe: Joi.string()
    .valid("current", "weekly", "monthly")
    .default("current"),
});

const spotlightQuerySchema = Joi.object({
  count: Joi.number().integer().min(1).max(10).default(5),
});

// Interface for query parameters
interface LeaderboardQuery {
  scope: string;
  limit: number;
  page: number;
  timeframe: string;
}

interface SpotlightQuery {
  count: number;
}

// GET /api/leaderboard?scope=global|subject - Main leaderboard endpoint
router.get("/", validate(leaderboardQuerySchema, "query"), async (req, res) => {
  try {
    const { scope, limit, page, timeframe } =
      req.query as unknown as LeaderboardQuery;
    const skip = (page - 1) * limit;

    let leaderboardData;

    if (timeframe === "current") {
      // Get the most recent snapshot
      leaderboardData = await LeaderboardSnapshot.getLatestSnapshot(scope);

      if (!leaderboardData) {
        // If no snapshot exists, generate real-time leaderboard
        leaderboardData = await generateRealTimeLeaderboard(scope, limit, skip);
      }
    } else {
      // Get historical data for weekly/monthly views
      const days = timeframe === "weekly" ? 7 : 30;
      const historicalData = await LeaderboardSnapshot.getHistoricalData(
        scope,
        days
      );
      leaderboardData = aggregateHistoricalData(historicalData, limit, skip);
    }

    if (!leaderboardData) {
      return res.status(404).json({
        success: false,
        message: "No leaderboard data found for the specified scope",
      });
    }

    // Paginate the top performers
    const totalCount = leaderboardData.topPerformers?.length || 0;
    const paginatedPerformers =
      leaderboardData.topPerformers?.slice(skip, skip + limit) || [];

    return res.json({
      success: true,
      data: {
        scope,
        timeframe,
        totalUsers: leaderboardData.totalUsers || 0,
        averageAccuracy: leaderboardData.averageAccuracy || 0,
        averagePoints: leaderboardData.averagePoints || 0,
        totalSubmissions: leaderboardData.totalSubmissions || 0,
        leaderboard: paginatedPerformers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalResults: totalCount,
          hasNext: skip + limit < totalCount,
          hasPrev: page > 1,
        },
        lastUpdated: leaderboardData.date || leaderboardData.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Leaderboard fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leaderboard data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/leaderboard/spotlight - Get spotlight users for carousel
router.get(
  "/spotlight",
  validate(spotlightQuerySchema, "query"),
  async (req, res) => {
    try {
      const { count } = req.query as unknown as SpotlightQuery;

      // Get top performers from global leaderboard
      const globalSnapshot = await LeaderboardSnapshot.getLatestSnapshot(
        "global"
      );

      let spotlightUsers = [];

      if (globalSnapshot && globalSnapshot.topPerformers) {
        // Get top performers with diverse achievements
        spotlightUsers = await generateSpotlightUsers(
          globalSnapshot.topPerformers,
          count
        );
      } else {
        // Fallback to real-time data
        spotlightUsers = await generateRealTimeSpotlight(count);
      }

      return res.json({
        success: true,
        data: {
          spotlightUsers,
          totalFeatured: spotlightUsers.length,
          lastUpdated: globalSnapshot?.date || new Date(),
        },
      });
    } catch (error: any) {
      console.error("Spotlight fetch error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch spotlight data",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// GET /api/leaderboard/user/:userId/history - Get user's rank history
router.get("/user/:userId/history", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const scope = (req.query.scope as string) || "global";
    const days = parseInt((req.query.days as string) || "30");

    const rankHistory = await LeaderboardSnapshot.getUserRankHistory(
      userId,
      scope,
      days
    );

    const formattedHistory = rankHistory.map((snapshot: any) => ({
      date: snapshot.date,
      rank: snapshot.topPerformers?.[0]?.rank || null,
      points: snapshot.topPerformers?.[0]?.totalPoints || 0,
      accuracy: snapshot.topPerformers?.[0]?.accuracy || 0,
    }));

    return res.json({
      success: true,
      data: {
        userId,
        scope,
        history: formattedHistory,
        totalSnapshots: formattedHistory.length,
      },
    });
  } catch (error: any) {
    console.error("User history fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user rank history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/leaderboard/stats - Get overall leaderboard statistics
router.get("/stats", async (req, res) => {
  try {
    const globalStats = await LeaderboardSnapshot.getLatestSnapshot("global");
    const mathStats = await LeaderboardSnapshot.getLatestSnapshot("math");
    const scienceStats = await LeaderboardSnapshot.getLatestSnapshot("science");
    const englishStats = await LeaderboardSnapshot.getLatestSnapshot("english");

    const stats = {
      global: globalStats
        ? {
            totalUsers: globalStats.totalUsers,
            averageAccuracy: globalStats.averageAccuracy,
            totalSubmissions: globalStats.totalSubmissions,
            lastUpdated: globalStats.date,
          }
        : null,
      subjects: {
        math: mathStats
          ? {
              totalUsers: mathStats.totalUsers,
              averageAccuracy: mathStats.averageAccuracy,
              totalSubmissions: mathStats.totalSubmissions,
            }
          : null,
        science: scienceStats
          ? {
              totalUsers: scienceStats.totalUsers,
              averageAccuracy: scienceStats.averageAccuracy,
              totalSubmissions: scienceStats.totalSubmissions,
            }
          : null,
        english: englishStats
          ? {
              totalUsers: englishStats.totalUsers,
              averageAccuracy: englishStats.averageAccuracy,
              totalSubmissions: englishStats.totalSubmissions,
            }
          : null,
      },
    };

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Stats fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leaderboard statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Helper function to generate real-time leaderboard when no snapshot exists
async function generateRealTimeLeaderboard(
  scope: string,
  limit: number,
  skip: number
) {
  // Aggregate user performance from all league submissions - FIXED: Cast as any[]
  const pipeline: any[] = [
    {
      $lookup: {
        from: "users",
        localField: "participants.userId",
        foreignField: "_id",
        as: "userDetails",
      },
    },
    {
      $unwind: "$participants",
    },
    {
      $unwind: "$userDetails",
    },
    {
      $match: {
        "userDetails._id": { $eq: "$participants.userId" },
        ...(scope !== "global" && { subject: scope }),
      },
    },
    {
      $group: {
        _id: "$participants.userId",
        username: { $first: "$userDetails.username" },
        email: { $first: "$userDetails.email" },
        totalPoints: { $sum: "$participants.bestScore.points" },
        totalSubmissions: { $sum: "$participants.submissionCount" },
        averageAccuracy: { $avg: "$participants.bestScore.accuracy" },
        averageTime: { $avg: "$participants.bestScore.timeInSeconds" },
        lastActive: { $max: "$participants.lastSubmission" },
      },
    },
    {
      $sort: { totalPoints: -1, averageAccuracy: -1 },
    },
    {
      $limit: 100, // Get top 100 for snapshot
    },
  ];

  const aggregatedData = await League.aggregate(pipeline);

  // Add ranks
  const topPerformers = aggregatedData.map((user: any, index: number) => ({
    userId: user._id,
    username: user.username,
    email: user.email,
    totalPoints: user.totalPoints || 0,
    accuracy: Math.round(user.averageAccuracy || 0),
    totalSubmissions: user.totalSubmissions || 0,
    averageTime: Math.round(user.averageTime || 0),
    lastActive: user.lastActive || new Date(),
    rank: index + 1,
  }));

  return {
    topPerformers,
    totalUsers: topPerformers.length,
    averageAccuracy:
      topPerformers.reduce((sum, u) => sum + u.accuracy, 0) /
        topPerformers.length || 0,
    averagePoints:
      topPerformers.reduce((sum, u) => sum + u.totalPoints, 0) /
        topPerformers.length || 0,
    totalSubmissions: topPerformers.reduce(
      (sum, u) => sum + u.totalSubmissions,
      0
    ),
    date: new Date(),
  };
}

// Helper function to generate spotlight users with diverse achievements
async function generateSpotlightUsers(topPerformers: any[], count: number) {
  // Select diverse top performers for spotlight
  const spotlightCriteria = [
    { type: "highest_points", filter: (users: any[]) => users[0] }, // #1 overall
    {
      type: "best_accuracy",
      filter: (users: any[]) =>
        users.sort((a, b) => b.accuracy - a.accuracy)[0],
    },
    {
      type: "most_active",
      filter: (users: any[]) =>
        users.sort((a, b) => b.totalSubmissions - a.totalSubmissions)[0],
    },
    {
      type: "fastest_solver",
      filter: (users: any[]) =>
        users.sort((a, b) => a.averageTime - b.averageTime)[0],
    },
    {
      type: "rising_star",
      filter: (users: any[]) =>
        users.find((u) => u.rank <= 10 && u.totalSubmissions < 20),
    },
  ];

  const featured = [];
  const usedUserIds = new Set();

  for (const criteria of spotlightCriteria.slice(0, count)) {
    const user = criteria.filter(topPerformers);
    if (user && !usedUserIds.has(user.userId.toString())) {
      featured.push({
        ...user,
        spotlightType: criteria.type,
        badge: getSpotlightBadge(criteria.type),
      });
      usedUserIds.add(user.userId.toString());
    }
  }

  return featured;
}

// Helper function to generate real-time spotlight when no snapshot exists
async function generateRealTimeSpotlight(count: number) {
  const realtimeData = await generateRealTimeLeaderboard("global", 20, 0);
  return generateSpotlightUsers(realtimeData.topPerformers, count);
}

// Helper function to get badge for spotlight type
function getSpotlightBadge(type: string) {
  const badges: {
    [key: string]: { name: string; icon: string; color: string };
  } = {
    highest_points: { name: "Points Leader", icon: "👑", color: "gold" },
    best_accuracy: { name: "Accuracy Master", icon: "🎯", color: "blue" },
    most_active: { name: "Most Active", icon: "🔥", color: "red" },
    fastest_solver: { name: "Speed Demon", icon: "⚡", color: "yellow" },
    rising_star: { name: "Rising Star", icon: "⭐", color: "purple" },
  };
  return badges[type] || { name: "Featured", icon: "🏆", color: "green" };
}

// Helper function to aggregate historical data
function aggregateHistoricalData(
  historicalData: any[],
  limit: number,
  skip: number
) {
  if (!historicalData.length) return null;

  // For historical views, we might want to show trends
  // For now, return the most recent snapshot with historical context
  const latest = historicalData[0];
  return {
    ...latest,
    topPerformers: latest.topPerformers?.slice(skip, skip + limit) || [],
  };
}

export default router;
