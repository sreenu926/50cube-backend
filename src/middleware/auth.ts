import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { IUser } from "../types";

// Extend Express Request interface to include user
export interface AuthRequest extends Request {
  userId?: string;
  user?: IUser;
}

export const auth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      res.status(401).json({
        message: "No token provided, access denied",
      });
      return;
    }

    // Check if token starts with 'Bearer '
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      res.status(401).json({
        message: "No token provided, access denied",
      });
      return;
    }

    try {
      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default-secret"
      ) as { userId: string };

      // Check if user still exists
      const user = await User.findById(decoded.userId);

      if (!user) {
        res.status(401).json({
          message: "Token is valid but user no longer exists",
        });
        return;
      }

      if (!user.isActive) {
        res.status(401).json({
          message: "User account is deactivated",
        });
        return;
      }

      // Add user info to request
      req.userId = decoded.userId;
      req.user = user;

      next();
    } catch (tokenError: any) {
      if (tokenError.name === "TokenExpiredError") {
        res.status(401).json({
          message: "Token has expired",
        });
        return;
      } else if (tokenError.name === "JsonWebTokenError") {
        res.status(401).json({
          message: "Invalid token",
        });
        return;
      } else {
        throw tokenError;
      }
    }
  } catch (error: any) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      message: "Server error in authentication",
      error: process.env.NODE_ENV === "development" ? error.message : {},
    });
  }
};

// Optional authentication - doesn't fail if no token
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      next();
      return;
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      next();
      return;
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default-secret"
      ) as { userId: string };
      const user = await User.findById(decoded.userId);

      if (user && user.isActive) {
        req.userId = decoded.userId;
        req.user = user;
      }
    } catch (tokenError) {
      // Ignore token errors in optional auth
    }

    next();
  } catch (error: any) {
    console.error("Optional auth middleware error:", error);
    next(); // Continue without authentication
  }
};
