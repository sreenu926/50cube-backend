import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register user (simple version for testing)
// @access  Public
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      res.status(400).json({
        message: "Please provide username, email, and password",
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      res.status(400).json({
        message: "User already exists with this email or username",
      });
      return;
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "default-secret",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        credits: user.credits,
        totalPoints: user.totalPoints,
      },
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({
      message: "Server error during registration",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user (simple version for testing)
// @access  Public
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      res.status(400).json({
        message: "Please provide email and password",
      });
      return;
    }

    // Find user by email
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      res.status(400).json({
        message: "Invalid credentials",
      });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      res.status(400).json({
        message: "Invalid credentials",
      });
      return;
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "default-secret",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        credits: user.credits,
        totalPoints: user.totalPoints,
        stats: user.stats,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
});

// @route   POST /api/auth/test-token
// @desc    Get a test JWT token for the existing test user
// @access  Public
router.post(
  "/test-token",
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Find the test user
      const testUser = await User.findOne({ email: "test@50cube.com" });

      if (!testUser) {
        res.status(404).json({
          message: "Test user not found. Create a test user first.",
        });
        return;
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: testUser._id },
        process.env.JWT_SECRET || "default-secret",
        { expiresIn: "7d" }
      );

      res.json({
        message: "Test token generated successfully",
        token,
        user: {
          id: testUser._id,
          username: testUser.username,
          email: testUser.email,
          credits: testUser.credits,
          totalPoints: testUser.totalPoints,
        },
        instructions:
          "Use this token in Authorization header: Bearer YOUR_TOKEN",
      });
    } catch (error: any) {
      console.error("Test token error:", error);
      res.status(500).json({
        message: "Error generating test token",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

export default router;
