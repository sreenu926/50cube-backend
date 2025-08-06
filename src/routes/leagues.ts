import express, { Response } from "express";
import League from "../models/League";
import User from "../models/User";
import { auth, AuthRequest } from "../middleware/auth";
import {
  validateLeagueEntry,
  validateScoreSubmission,
  validateObjectId,
} from "../middleware/validation";
import { Types } from "mongoose";

const router = express.Router();

// @route   GET /api/leagues
// @desc    Get all active leagues
// @access  Public
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      status = "active",
      category,
      skillLevel,
      page = "1",
      limit = "10",
    } = req.query;

    const query: any = { isPublic: true };

    if (status) query.status = status;
    if (category) query.category = category;
    if (skillLevel) query["rules.skillLevel"] = skillLevel;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [leagues, total] = await Promise.all([
      League.find(query)
        .sort({ startDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("createdBy", "username")
        .lean(),
      League.countDocuments(query),
    ]);

    // Add participant count and spots remaining
    const enrichedLeagues = leagues.map((league) => ({
      ...league,
      participantCount: league.participants.length,
      spotsRemaining: league.maxParticipants - league.participants.length,
    }));

    res.json({
      leagues: enrichedLeagues,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error("Get leagues error:", error);
    res.status(500).json({
      message: "Error fetching leagues",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
});

// @route   GET /api/leagues/:id
// @desc    Get specific league details
// @access  Public
router.get(
  "/:id",
  validateObjectId("id"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const league = await League.findById(req.params.id)
        .populate("createdBy", "username")
        .lean();

      if (!league) {
        res.status(404).json({
          message: "League not found",
        });
        return;
      }

      // Add computed fields
      const enrichedLeague = {
        ...league,
        participantCount: league.participants.length,
        spotsRemaining: league.maxParticipants - league.participants.length,
        durationInDays: Math.ceil(
          (league.endDate.getTime() - league.startDate.getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      };

      res.json({ league: enrichedLeague });
    } catch (error: any) {
      console.error("Get league error:", error);
      res.status(500).json({
        message: "Error fetching league",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

// @route   POST /api/leagues/enter
// @desc    Join a league (M13 Requirement)
// @access  Private
router.post(
  "/enter",
  auth,
  validateLeagueEntry,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { leagueId } = req.body;
      const userId = req.userId!;

      const league = await League.findById(leagueId);

      if (!league) {
        res.status(404).json({
          message: "League not found",
        });
        return;
      }

      const user = await User.findById(userId);

      if (!user) {
        res.status(404).json({
          message: "User not found",
        });
        return;
      }

      try {
        await league.addParticipant(new Types.ObjectId(userId), user.username);

        res.json({
          message: "Successfully joined the league",
          league: {
            id: league._id,
            name: league.name,
            participantCount: league.participants.length,
            spotsRemaining: league.maxParticipants - league.participants.length,
            yourRank: null, // Will be set after first submission
          },
        });
      } catch (leagueError: any) {
        res.status(400).json({
          message: leagueError.message,
        });
        return;
      }
    } catch (error: any) {
      console.error("League entry error:", error);
      res.status(500).json({
        message: "Error joining league",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

// @route   POST /api/leagues/submit
// @desc    Submit score to league (M13 Requirement)
// @access  Private
router.post(
  "/submit",
  auth,
  validateScoreSubmission,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { leagueId, accuracy, timeInSeconds, points, gameData } = req.body;
      const userId = req.userId!;

      const league = await League.findById(leagueId);

      if (!league) {
        res.status(404).json({
          message: "League not found",
        });
        return;
      }

      const scoreData = {
        accuracy,
        timeInSeconds,
        points,
        gameData,
      };

      try {
        await league.submitScore(new Types.ObjectId(userId), scoreData);

        // Update user's total points and stats
        const user = await User.findById(userId);
        if (user) {
          user.updateStats({
            points,
            accuracy,
            timeInSeconds,
          });
          await user.save();
        }

        // Get updated leaderboard
        const leaderboard = league.getLeaderboard();
        const userRank =
          leaderboard.find((entry) => entry.userId.toString() === userId)
            ?.rank || null;

        res.json({
          message: "Score submitted successfully",
          submission: {
            ...scoreData,
            submittedAt: new Date(),
          },
          yourRank: userRank,
          leaderboard: leaderboard.slice(0, 10), // Top 10 for response
        });
      } catch (leagueError: any) {
        res.status(400).json({
          message: leagueError.message,
        });
        return;
      }
    } catch (error: any) {
      console.error("Score submission error:", error);
      res.status(500).json({
        message: "Error submitting score",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

// @route   GET /api/leagues/:id/leaderboard
// @desc    Get league leaderboard (M13 Requirement)
// @access  Public
router.get(
  "/:id/leaderboard",
  validateObjectId("id"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { page = "1", limit = "50" } = req.query;
      const leagueId = req.params.id;

      const league = await League.findById(leagueId);

      if (!league) {
        res.status(404).json({
          message: "League not found",
        });
        return;
      }

      const fullLeaderboard = league.getLeaderboard();

      // Pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;
      const paginatedLeaderboard = fullLeaderboard.slice(skip, skip + limitNum);

      // Add rank changes and additional stats
      const enrichedLeaderboard = paginatedLeaderboard.map((entry) => {
        const participant = league.participants.find(
          (p) => p.userId.toString() === entry.userId.toString()
        );

        return {
          ...entry,
          joinedAt: participant?.joinedAt,
          totalSubmissions: participant?.submissions.length || 0,
          submissionsRemaining:
            league.rules.maxSubmissions -
            (participant?.submissions.length || 0),
          improvementRate:
            participant?.submissions.length &&
            participant.submissions.length > 1
              ? (
                  ((entry.points - participant.submissions[0].points) /
                    participant.submissions[0].points) *
                  100
                ).toFixed(1)
              : null,
        };
      });

      res.json({
        leaderboard: enrichedLeaderboard,
        league: {
          id: league._id,
          name: league.name,
          status: league.status,
          scoringMethod: league.rules.scoringMethod,
          maxSubmissions: league.rules.maxSubmissions,
          participantCount: league.participants.length,
          startDate: league.startDate,
          endDate: league.endDate,
          prizes: league.prizes,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: fullLeaderboard.length,
          pages: Math.ceil(fullLeaderboard.length / limitNum),
        },
      });
    } catch (error: any) {
      console.error("Get leaderboard error:", error);
      res.status(500).json({
        message: "Error fetching leaderboard",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

export default router;
