import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

// Import routes
import authRoutes from "./routes/auth";
import leagueRoutes from "./routes/leagues";
import leaderboardRoutes from "./routes/leaderboard"; // M14 ROUTES
import readersRoutes from "./routes/readers"; // NEW M15 ROUTES

// Import models to ensure they're registered
import "./models/User";
import "./models/League";
import "./models/LeaderboardSnapshot"; // M14 MODEL
import "./models/Reader"; // NEW M15 MODEL

// Import services
import { snapshotJobService } from "./services/snapshotJob"; // M14 SERVICE

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:5173", // Vite dev server
    "http://localhost:3000", // Alternative dev port
    "https://your-frontend-domain.com", // Production domain
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "50cube API is running",
    timestamp: new Date().toISOString(),
    modules: {
      M13: "Leagues - ✅ Complete",
      M14: "Spotlight & Global Leaderboard - ✅ Complete",
      M15: "Readers - ✅ Complete", // UPDATED!
    },
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/leagues", leagueRoutes);
app.use("/api/leaderboard", leaderboardRoutes); // M14 ROUTES
app.use("/api/readers", readersRoutes); // NEW M15 ROUTES

// M14 Snapshot Job Management Endpoints
app.get("/api/admin/snapshot-status", (req, res) => {
  const status = snapshotJobService.getJobStatus();
  res.json({
    success: true,
    data: status,
  });
});

app.post("/api/admin/trigger-snapshot", async (req, res) => {
  try {
    console.log("📊 Manual snapshot trigger requested via API");
    await snapshotJobService.triggerManualSnapshot();
    res.json({
      success: true,
      message: "Manual snapshot triggered successfully",
    });
  } catch (error: any) {
    console.error("❌ Manual snapshot trigger failed:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger manual snapshot",
      error: error.message,
    });
  }
});

app.get("/api/admin/snapshot-stats", async (req, res) => {
  try {
    const stats = await snapshotJobService.getSnapshotStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("❌ Failed to fetch snapshot stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch snapshot statistics",
      error: error.message,
    });
  }
});

// M15 Sample Data Creation Endpoint (Development only)
app.post("/api/admin/create-sample-readers", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        success: false,
        message: "Sample data creation not allowed in production",
      });
      return;
    }

    const Reader = mongoose.model("Reader");

    // Check if readers already exist
    const existingCount = await Reader.countDocuments();
    if (existingCount > 0) {
      res.json({
        success: true,
        message: `Sample readers already exist (${existingCount} found)`,
        existingCount,
      });
      return;
    }

    // Sample reader data
    const sampleReaders = [
      {
        title: "Advanced Calculus Mastery",
        description:
          "Comprehensive guide to advanced calculus concepts including limits, derivatives, and integrals. Perfect for competitive exam preparation.",
        subject: "math",
        difficulty: "advanced",
        pages: 45,
        price: 25,
        fileUrl: "https://sample-pdfs.s3.amazonaws.com/calculus-mastery.pdf",
        fileName: "calculus-mastery.pdf",
        fileSize: 2457600,
        author: "Dr. Sarah Mathematics",
        tags: ["calculus", "derivatives", "integrals", "competitive-exams"],
        rating: 4.8,
        reviews: 156,
      },
      {
        title: "Basic Algebra for Beginners",
        description:
          "Start your algebra journey with this easy-to-follow guide covering fundamental concepts and problem-solving techniques.",
        subject: "math",
        difficulty: "beginner",
        pages: 30,
        price: 15,
        fileUrl: "https://sample-pdfs.s3.amazonaws.com/basic-algebra.pdf",
        fileName: "basic-algebra.pdf",
        fileSize: 1843200,
        author: "Prof. Mike Numbers",
        tags: ["algebra", "basics", "problem-solving", "fundamentals"],
        rating: 4.5,
        reviews: 89,
      },
      {
        title: "Physics: Mechanics & Motion",
        description:
          "Deep dive into classical mechanics, covering Newton's laws, energy, momentum, and rotational dynamics with practical examples.",
        subject: "science",
        difficulty: "intermediate",
        pages: 38,
        price: 20,
        fileUrl: "https://sample-pdfs.s3.amazonaws.com/physics-mechanics.pdf",
        fileName: "physics-mechanics.pdf",
        fileSize: 3072000,
        author: "Dr. Emma Physics",
        tags: ["physics", "mechanics", "motion", "newton-laws"],
        rating: 4.7,
        reviews: 234,
      },
      {
        title: "Chemistry: Organic Compounds",
        description:
          "Master organic chemistry with detailed explanations of molecular structures, reactions, and synthesis pathways.",
        subject: "science",
        difficulty: "advanced",
        pages: 52,
        price: 30,
        fileUrl: "https://sample-pdfs.s3.amazonaws.com/organic-chemistry.pdf",
        fileName: "organic-chemistry.pdf",
        fileSize: 4194304,
        author: "Dr. James Molecule",
        tags: ["chemistry", "organic", "molecules", "reactions"],
        rating: 4.9,
        reviews: 178,
      },
      {
        title: "English Grammar Essentials",
        description:
          "Complete guide to English grammar rules, common mistakes, and writing techniques for clear communication.",
        subject: "english",
        difficulty: "beginner",
        pages: 25,
        price: 12,
        fileUrl: "https://sample-pdfs.s3.amazonaws.com/grammar-essentials.pdf",
        fileName: "grammar-essentials.pdf",
        fileSize: 1536000,
        author: "Prof. Lisa Language",
        tags: ["grammar", "writing", "communication", "rules"],
        rating: 4.3,
        reviews: 92,
      },
      {
        title: "Creative Writing Workshop",
        description:
          "Unleash your creativity with advanced writing techniques, character development, and storytelling methods.",
        subject: "english",
        difficulty: "intermediate",
        pages: 35,
        price: 18,
        fileUrl: "https://sample-pdfs.s3.amazonaws.com/creative-writing.pdf",
        fileName: "creative-writing.pdf",
        fileSize: 2048000,
        author: "Maya Storyteller",
        tags: ["creative-writing", "storytelling", "characters", "techniques"],
        rating: 4.6,
        reviews: 145,
      },
      {
        title: "Study Skills & Time Management",
        description:
          "Proven strategies for effective studying, time management, and academic success across all subjects.",
        subject: "general",
        difficulty: "beginner",
        pages: 28,
        price: 10,
        fileUrl: "https://sample-pdfs.s3.amazonaws.com/study-skills.pdf",
        fileName: "study-skills.pdf",
        fileSize: 1228800,
        author: "Dr. Success Mentor",
        tags: ["study-skills", "time-management", "productivity", "academic"],
        rating: 4.4,
        reviews: 267,
      },
      {
        title: "Advanced Biology: Cell Structure",
        description:
          "Detailed exploration of cellular biology, organelles, and molecular processes within living cells.",
        subject: "science",
        difficulty: "advanced",
        pages: 42,
        price: 28,
        fileUrl: "https://sample-pdfs.s3.amazonaws.com/cell-biology.pdf",
        fileName: "cell-biology.pdf",
        fileSize: 3584000,
        author: "Dr. Cell Expert",
        tags: ["biology", "cells", "organelles", "molecular"],
        rating: 4.8,
        reviews: 189,
      },
    ];

    const insertedReaders = await Reader.insertMany(sampleReaders);

    res.json({
      success: true,
      message: `Successfully created ${insertedReaders.length} sample readers`,
      readers: insertedReaders.map((r: any) => ({
        id: r._id,
        title: r.title,
        subject: r.subject,
        price: r.price,
      })),
    });
  } catch (error: any) {
    console.error("❌ Error creating sample readers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create sample readers",
      error: error.message,
    });
  }
});

// Development/Testing endpoints (keep existing ones)
app.get("/api/users", async (req, res) => {
  try {
    const User = mongoose.model("User");
    const users = await User.find().select("-password");
    res.json({ success: true, count: users.length, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/leagues-test", async (req, res) => {
  try {
    const League = mongoose.model("League");
    const leagues = await League.find();
    res.json({ success: true, count: leagues.length, data: leagues });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test user creation endpoint
app.post("/api/test-user", async (req, res) => {
  try {
    const User = mongoose.model("User");
    const testUser = new User({
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@50cube.com`,
      password: "hashedPassword123",
    });
    await testUser.save();
    res.json({
      success: true,
      message: "Test user created",
      userId: testUser._id,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test league creation endpoint
app.post("/api/test-league", async (req, res) => {
  try {
    const League = mongoose.model("League");
    const testLeague = new League({
      name: `Test League ${Date.now()}`,
      subject: "math",
      description: "Auto-generated test league",
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      maxParticipants: 100,
      entryFee: 0,
      prizePool: { total: 1000, distribution: [500, 300, 200] },
      rules: {
        submissionsPerUser: 3,
        timeLimit: 600,
        scoringMethod: "accuracy_then_time",
      },
      status: "active",
    });
    await testLeague.save();
    res.json({
      success: true,
      message: "Test league created",
      leagueId: testLeague._id,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("❌ Unhandled error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
);

// Add a simple root route - PUT THIS BEFORE THE 404 HANDLER
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "50cube API is running on Vercel!",
    timestamp: new Date().toISOString(),
    modules: {
      M13: "Leagues - ✅ Complete",
      M14: "Spotlight & Global Leaderboard - ✅ Complete",
      M15: "Readers - ✅ Complete",
    },
    endpoints: [
      "GET /api/health - Health check",
      "GET /api/leagues - List leagues",
      "GET /api/leaderboard - Global leaderboard",
      "GET /api/readers/catalog - Browse readers",
    ],
  });
});

// 404 handler - KEEP THIS AT THE END
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Database connection for serverless
async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    try {
      console.log("🔄 Connecting to MongoDB...");
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/50cube"
      );
      console.log("✅ Connected to MongoDB successfully");
    } catch (error: any) {
      console.error("❌ Failed to connect to MongoDB:", error);
    }
  }
}

// Initialize database connection
connectDB();

// Initialize M14 snapshot job service (but don't start the cron job in serverless)
try {
  console.log("🔄 Initializing M14 snapshot job service...");
  snapshotJobService.initializeDailyJob();
  console.log("✅ M14 snapshot job service ready");
} catch (error) {
  console.log("⚠️ Snapshot job service initialization skipped in serverless");
}

// Add a simple root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "50cube API is running on Vercel!",
    timestamp: new Date().toISOString(),
    modules: {
      M13: "Leagues - ✅ Complete",
      M14: "Spotlight & Global Leaderboard - ✅ Complete",
      M15: "Readers - ✅ Complete",
    },
    endpoints: [
      "GET /api/health - Health check",
      "GET /api/leagues - List leagues",
      "GET /api/leaderboard - Global leaderboard",
      "GET /api/readers/catalog - Browse readers",
    ],
  });
});

// Export the app for Vercel
export default app;
