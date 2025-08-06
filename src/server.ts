import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

// Import routes
import authRoutes from "./routes/auth";
// ✅ COMMENTED OUT - Using mock data instead
// import leagueRoutes from "./routes/leagues";
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

// ============== MOCK LEAGUES DATA ==============
const MOCK_LEAGUES = [
  {
    _id: "league1",
    id: "league1",
    name: "Speed Reading Championship",
    description:
      "Test your reading speed and comprehension in this weekly challenge",
    subject: "reading",
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    maxParticipants: 100,
    participants: 23,
    entryFee: 0,
    prizePool: { total: 1000, distribution: [500, 300, 200] },
    rules: {
      submissionsPerUser: 3,
      timeLimit: 600, // 10 minutes
      scoringMethod: "accuracy_then_time",
    },
    status: "active",
    difficulty: "Intermediate",
    category: "Speed",
    prize: "$1000 Credits + Premium Access",
    prizeTable: [
      { rank: 1, reward: "500 Credits + Gold Badge", credits: 500 },
      { rank: 2, reward: "300 Credits + Silver Badge", credits: 300 },
      { rank: 3, reward: "200 Credits + Bronze Badge", credits: 200 },
    ],
  },
  {
    _id: "league2",
    id: "league2",
    name: "Math Masters League",
    description: "Compete in advanced mathematics problems and calculations",
    subject: "math",
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    endDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    maxParticipants: 50,
    participants: 7,
    entryFee: 0,
    prizePool: { total: 1500, distribution: [800, 400, 300] },
    rules: {
      submissionsPerUser: 1,
      timeLimit: 900, // 15 minutes
      scoringMethod: "accuracy_then_time",
    },
    status: "upcoming",
    difficulty: "Advanced",
    category: "Accuracy",
    prize: "$1500 Credits + Expert Badge",
    prizeTable: [
      { rank: 1, reward: "800 Credits + Math Expert Badge", credits: 800 },
      { rank: 2, reward: "400 Credits + Calculator Badge", credits: 400 },
      { rank: 3, reward: "300 Credits + Numbers Badge", credits: 300 },
    ],
  },
  {
    _id: "league3",
    id: "league3",
    name: "Science Quiz Challenge",
    description:
      "General science knowledge competition covering physics, chemistry, and biology",
    subject: "science",
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    maxParticipants: 200,
    participants: 156,
    entryFee: 0,
    prizePool: { total: 2000, distribution: [1000, 600, 400] },
    rules: {
      submissionsPerUser: 2,
      timeLimit: 720, // 12 minutes
      scoringMethod: "accuracy_then_time",
    },
    status: "active",
    difficulty: "Beginner",
    category: "Mixed",
    prize: "$2000 Credits + Science Badge",
    prizeTable: [
      { rank: 1, reward: "1000 Credits + Scientist Badge", credits: 1000 },
      { rank: 2, reward: "600 Credits + Lab Badge", credits: 600 },
      { rank: 3, reward: "400 Credits + Discovery Badge", credits: 400 },
    ],
  },
];

const MOCK_LEADERBOARD = [
  {
    userId: "user1",
    username: "SpeedReader99",
    rank: 1,
    accuracy: 0.95,
    timeScore: 480,
    totalScore: 95.8,
    completionTime: 480,
  },
  {
    userId: "user2",
    username: "QuickLearner",
    rank: 2,
    accuracy: 0.95,
    timeScore: 520,
    totalScore: 95.2,
    completionTime: 520,
  },
  {
    userId: "user3",
    username: "StudyMaster",
    rank: 3,
    accuracy: 0.9,
    timeScore: 450,
    totalScore: 90.5,
    completionTime: 450,
  },
];

// ✅ MOCK READERS DATA (for M15)
const MOCK_READERS = [
  {
    _id: "reader1",
    title: "Advanced Calculus Mastery",
    description:
      "Comprehensive guide to advanced calculus concepts including limits, derivatives, and integrals.",
    subject: "math",
    difficulty: "advanced",
    pages: 45,
    price: 25,
    author: "Dr. Sarah Mathematics",
    rating: 4.8,
    reviews: 156,
  },
  {
    _id: "reader2",
    title: "Physics: Mechanics & Motion",
    description:
      "Deep dive into classical mechanics, covering Newton's laws, energy, momentum.",
    subject: "science",
    difficulty: "intermediate",
    pages: 38,
    price: 20,
    author: "Dr. Emma Physics",
    rating: 4.7,
    reviews: 234,
  },
  {
    _id: "reader3",
    title: "English Grammar Essentials",
    description:
      "Complete guide to English grammar rules, common mistakes, and writing techniques.",
    subject: "english",
    difficulty: "beginner",
    pages: 25,
    price: 12,
    author: "Prof. Lisa Language",
    rating: 4.3,
    reviews: 92,
  },
];

// ✅ MOCK LEADERBOARD DATA (for M14)
const MOCK_SPOTLIGHT_DATA = {
  topPerformer: "SpeedReader99",
  streak: 15,
  recentAchievement: "Math Master Badge",
  totalScore: 2847,
};

const MOCK_STATS_DATA = {
  totalUsers: 1250,
  activeToday: 89,
  completedToday: 45,
  totalChallenges: 342,
};

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "https://50cube-staging.vercel.app",
    /.*\.vercel\.app$/,
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  optionsSuccessStatus: 200,
};

// Enhanced CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`🌐 CORS Request from origin: ${origin || "no-origin"}`);

  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "https://50cube-staging.vercel.app",
  ];

  if (
    origin &&
    (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app"))
  ) {
    res.header("Access-Control-Allow-Origin", origin);
    console.log(`✅ CORS: Allowed origin ${origin}`);
  } else if (!origin) {
    res.header("Access-Control-Allow-Origin", "*");
    console.log(`✅ CORS: Allowed request with no origin`);
  } else {
    console.log(`❌ CORS: Blocked origin ${origin}`);
  }

  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept, Origin"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    console.log(`🔄 CORS: Handling OPTIONS preflight for ${req.path}`);
    res.sendStatus(200);
    return;
  }

  next();
});

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const origin = req.headers.origin || "no-origin";
  console.log(`${timestamp} - ${req.method} ${req.path} - Origin: ${origin}`);
  next();
});

// ============== MOCK LEAGUE ROUTES (M13) ==============

app.get("/api/leagues", (req, res) => {
  console.log("📚 Fetching mock leagues catalog");
  res.json({
    success: true,
    data: MOCK_LEAGUES,
    message: "Mock leagues data - Set up MongoDB Atlas for real data",
  });
});

app.get("/api/leagues/:id", (req, res) => {
  const leagueId = req.params.id;
  console.log(`🎯 Fetching league details for: ${leagueId}`);

  const league = MOCK_LEAGUES.find(
    (l) => l.id === leagueId || l._id === leagueId
  );
  if (league) {
    res.json({
      success: true,
      data: league,
    });
  } else {
    res.status(404).json({
      success: false,
      message: "League not found",
    });
  }
});

app.get("/api/leagues/:id/leaderboard", (req, res) => {
  const leagueId = req.params.id;
  console.log(`🏆 Fetching leaderboard for league: ${leagueId}`);

  const league = MOCK_LEAGUES.find(
    (l) => l.id === leagueId || l._id === leagueId
  );
  if (league) {
    res.json({
      success: true,
      data: MOCK_LEADERBOARD,
    });
  } else {
    res.status(404).json({
      success: false,
      message: "League not found",
    });
  }
});

app.post("/api/leagues/enter", (req, res) => {
  const { leagueId } = req.body;
  console.log(`🚪 User entering league: ${leagueId}`);

  const league = MOCK_LEAGUES.find(
    (l) => l.id === leagueId || l._id === leagueId
  );
  if (league) {
    league.participants += 1;
    res.json({
      success: true,
      message: "Successfully joined league!",
    });
  } else {
    res.status(404).json({
      success: false,
      message: "League not found",
    });
  }
});

app.post("/api/leagues/submit", (req, res) => {
  const { leagueId, answers, completionTime, accuracy } = req.body;
  console.log(`📝 Submitting to league: ${leagueId}`, {
    completionTime,
    accuracy,
  });

  const league = MOCK_LEAGUES.find(
    (l) => l.id === leagueId || l._id === leagueId
  );
  if (league) {
    res.json({
      success: true,
      message: "Results submitted successfully!",
      data: {
        rank: Math.floor(Math.random() * 10) + 1,
        accuracy,
        completionTime,
      },
    });
  } else {
    res.status(404).json({
      success: false,
      message: "League not found",
    });
  }
});

app.post("/api/admin/snapshot/trigger", async (req, res) => {
  try {
    console.log("🔄 Manual snapshot trigger requested");
    await snapshotJobService.triggerManualSnapshot();
    res.json({
      success: true,
      message: "Snapshot creation triggered successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("❌ Error triggering snapshot:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger snapshot",
      error: error.message,
    });
  }
});

// Get snapshot statistics
app.get("/api/admin/snapshot/stats", async (req, res) => {
  try {
    const stats = await snapshotJobService.getSnapshotStats();
    res.json({
      success: true,
      data: stats || {
        totalSnapshots: 0,
        message: "No snapshots available (using mock data)",
      },
    });
  } catch (error: any) {
    console.error("❌ Error getting snapshot stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get snapshot stats",
      error: error.message,
    });
  }
});

// ============== M15 SAMPLE PDF ROUTES ==============

// Serve sample PDF content (mock file download)
app.get("/api/readers/file/:token", (req, res) => {
  const { token } = req.params;
  console.log(`📥 Serving sample PDF file for token: ${token}`);

  try {
    // In production, you'd verify the JWT token here
    // For demo, we'll just serve sample content

    // Set PDF headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="sample-reader.pdf"'
    );

    // For demo purposes, return mock PDF info
    // In production, you'd stream the actual PDF file
    res.json({
      success: true,
      message: "PDF Download Ready",
      filename: "sample-reader.pdf",
      content: "This would be the actual PDF content in production",
      size: "2.5MB",
      pages: 45,
      note: "In production, this would stream the actual PDF file. For demo purposes, this shows the download metadata.",
      downloadInstructions: [
        "This URL would serve the actual PDF file",
        "The token expires in 24 hours",
        "Each user has a limited number of downloads",
      ],
    });
  } catch (error: any) {
    console.error("❌ Error serving PDF file:", error);
    res.status(500).json({
      success: false,
      message: "Failed to serve PDF file",
      error: error.message,
    });
  }
});

// Add sample PDF endpoints for different readers
app.get("/api/readers/samples/:readerId", (req, res) => {
  const { readerId } = req.params;
  console.log(`📖 Serving sample preview for reader: ${readerId}`);

  const sampleContent = {
    reader1: {
      title: "Advanced Calculus Mastery",
      preview:
        "Chapter 1: Introduction to Limits\n\nCalculus is the mathematical study of continuous change...",
      tableOfContents: [
        "Chapter 1: Limits and Continuity",
        "Chapter 2: Derivatives",
        "Chapter 3: Applications of Derivatives",
        "Chapter 4: Integration",
        "Chapter 5: Advanced Techniques",
      ],
    },
    reader2: {
      title: "Physics: Mechanics & Motion",
      preview:
        "Chapter 1: Newton's Laws of Motion\n\nThe foundation of classical mechanics rests upon three fundamental laws...",
      tableOfContents: [
        "Chapter 1: Newton's Laws",
        "Chapter 2: Energy and Work",
        "Chapter 3: Momentum",
        "Chapter 4: Rotational Motion",
        "Chapter 5: Gravitation",
      ],
    },
    reader3: {
      title: "English Grammar Essentials",
      preview:
        "Chapter 1: Parts of Speech\n\nUnderstanding the building blocks of language...",
      tableOfContents: [
        "Chapter 1: Parts of Speech",
        "Chapter 2: Sentence Structure",
        "Chapter 3: Punctuation Rules",
        "Chapter 4: Common Mistakes",
        "Chapter 5: Writing Style",
      ],
    },
  };

  const sample = sampleContent[readerId as keyof typeof sampleContent];

  if (sample) {
    res.json({
      success: true,
      data: sample,
    });
  } else {
    res.status(404).json({
      success: false,
      message: "Sample not found",
    });
  }
});

// ============== MOCK LEADERBOARD ROUTES (M14) ==============

app.get("/api/leaderboard/spotlight", (req, res) => {
  console.log("🌟 Fetching spotlight data");
  res.json({
    success: true,
    data: MOCK_SPOTLIGHT_DATA,
  });
});

app.get("/api/leaderboard/stats", (req, res) => {
  console.log("📊 Fetching stats data");
  res.json({
    success: true,
    data: MOCK_STATS_DATA,
  });
});

app.get("/api/leaderboard", (req, res) => {
  const { scope = "global", subject } = req.query;
  console.log(
    `📈 Fetching global leaderboard - scope: ${scope}, subject: ${subject}`
  );

  res.json({
    success: true,
    data: MOCK_LEADERBOARD.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      globalRank: index + 1,
    })),
  });
});

// ============== MOCK READERS ROUTES (M15) ==============

app.get("/api/readers/catalog", (req, res) => {
  console.log("📖 Fetching mock readers catalog");
  res.json({
    success: true,
    data: MOCK_READERS,
    message: "Mock readers data - Set up MongoDB Atlas for real data",
  });
});

app.post("/api/readers/buy", (req, res) => {
  const { readerId } = req.body;
  console.log(`💳 User buying reader: ${readerId}`);

  const reader = MOCK_READERS.find((r) => r._id === readerId);
  if (reader) {
    res.json({
      success: true,
      data: {
        id: `purchase_${Date.now()}`,
        readerId,
        purchaseDate: new Date().toISOString(),
        price: reader.price,
      },
      message: "Reader purchased successfully!",
    });
  } else {
    res.status(404).json({
      success: false,
      message: "Reader not found",
    });
  }
});

app.get("/api/readers/download/:id", (req, res) => {
  const readerId = req.params.id;
  console.log(`📥 Getting download link for reader: ${readerId}`);

  const reader = MOCK_READERS.find((r) => r._id === readerId);
  if (reader) {
    res.json({
      success: true,
      data: {
        downloadUrl: `https://sample-downloads.s3.amazonaws.com/${readerId}.pdf`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      },
    });
  } else {
    res.status(404).json({
      success: false,
      message: "Reader not found",
    });
  }
});

app.get("/api/readers/library", (req, res) => {
  console.log("📚 Fetching user library");
  res.json({
    success: true,
    data: MOCK_READERS.slice(0, 2).map((reader) => ({
      id: `purchase_${reader._id}`,
      readerId: reader._id,
      title: reader.title,
      purchaseDate: new Date().toISOString(),
      downloadCount: Math.floor(Math.random() * 5),
    })),
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "50cube API is running on Vercel!",
    timestamp: new Date().toISOString(),
    modules: {
      M13: "Leagues - ✅ Complete (Mock Data)",
      M14: "Spotlight & Global Leaderboard - ✅ Complete (Mock Data)",
      M15: "Readers - ✅ Complete (Mock Data)",
    },
    environment: process.env.NODE_ENV || "development",
    cors: "enabled",
  });
});

// API Routes (only non-league routes)
app.use("/api/auth", authRoutes);
// ✅ REMOVED - Using mock data: app.use("/api/leagues", leagueRoutes);
app.use("/api/leaderboard", leaderboardRoutes); // M14 ROUTES
app.use("/api/readers", readersRoutes); // NEW M15 ROUTES

// Simple root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "50cube API is running on Vercel!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    modules: {
      M13: "Leagues - ✅ Complete (Mock Data)",
      M14: "Spotlight & Global Leaderboard - ✅ Complete (Mock Data)",
      M15: "Readers - ✅ Complete (Mock Data)",
    },
    endpoints: [
      "GET /api/health - Health check",
      "GET /api/leagues - List leagues (MOCK)",
      "GET /api/leaderboard - Global leaderboard (MOCK)",
      "GET /api/readers/catalog - Browse readers (MOCK)",
    ],
    cors: "enabled with enhanced logging",
  });
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

// 404 handler
app.use("*", (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl} not found`);
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      "GET /api/health",
      "GET /api/leagues",
      "GET /api/leagues/:id",
      "GET /api/leagues/:id/leaderboard",
      "POST /api/leagues/enter",
      "POST /api/leagues/submit",
      "GET /api/leaderboard/spotlight",
      "GET /api/leaderboard/stats",
      "GET /api/readers/catalog",
    ],
  });
});

// ✅ COMMENTED OUT - MongoDB connection (not needed for mock data)
/*
async function connectDB() {
  if (mongoose.connection.readyState === 0) {
    try {
      console.log("🔄 Connecting to MongoDB...");
      await mongoose.connect(
        process.env.MONGODB_URI || "mongodb://localhost:27017/50cube",
        {
          serverSelectionTimeoutMS: 10000,
          socketTimeoutMS: 45000,
        }
      );
      console.log("✅ Connected to MongoDB successfully");
    } catch (error: any) {
      console.error("❌ Failed to connect to MongoDB:", error);
    }
  }
}

// Initialize database connection
connectDB();
*/

try {
  console.log("🔄 Initializing M14 snapshot job service...");
  snapshotJobService.initializeDailyJob();
  console.log("✅ M14 snapshot job service ready");
} catch (error) {
  console.log(
    "⚠️ Snapshot job service initialization failed (MongoDB required for full functionality)"
  );
}

console.log("🚀 50cube API starting with MOCK DATA for M13, M14, M15");

// Export the app for Vercel
export default app;
