import express, { Request, Response } from "express";
import { Reader, IReaderModel, IReader } from "../models/Reader";
import { User } from "../models/User";
import { auth, optionalAuth, AuthRequest } from "../middleware/auth";
import { validate, validateObjectId } from "../middleware/validation";
import Joi from "joi";
import jwt from "jsonwebtoken";

const router = express.Router();

// Validation schemas
const catalogQuerySchema = Joi.object({
  subject: Joi.string()
    .valid("math", "science", "english", "general")
    .optional(),
  difficulty: Joi.string()
    .valid("beginner", "intermediate", "advanced")
    .optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  search: Joi.string().trim().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  sortBy: Joi.string()
    .valid("createdAt", "title", "price", "rating", "popularity")
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

const purchaseSchema = Joi.object({
  readerId: Joi.string().required().messages({
    "any.required": "Reader ID is required",
  }),
});

// @route   GET /api/readers/catalog
// @desc    Get readers catalog with filtering and pagination
// @access  Public (but shows ownership status if authenticated)
router.get(
  "/catalog",
  optionalAuth,
  validate(catalogQuerySchema, "query"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        subject,
        difficulty,
        minPrice,
        maxPrice,
        tags,
        search,
        page,
        limit,
        sortBy,
        sortOrder,
      } = req.query as any;

      // Search readers using the static method
      const results = await (Reader as IReaderModel).searchReaders(
        {
          subject,
          difficulty,
          minPrice,
          maxPrice,
          tags,
          search,
        },
        {
          page,
          limit,
          sortBy,
          sortOrder,
        }
      );

      const readers = results[0]?.data || [];
      const totalResults = results[0]?.metadata[0]?.total || 0;
      const totalPages = Math.ceil(totalResults / limit);

      // If user is authenticated, check ownership status
      let readersWithOwnership = readers;
      if (req.user) {
        readersWithOwnership = readers.map((reader: any) => ({
          ...reader,
          owned: req.user!.ownsReader(reader._id),
        }));
      }

      res.json({
        success: true,
        data: {
          readers: readersWithOwnership,
          pagination: {
            currentPage: page,
            totalPages,
            totalResults,
            hasNext: page < totalPages,
            hasPrev: page > 1,
            resultsPerPage: limit,
          },
          filters: {
            subject,
            difficulty,
            priceRange: { min: minPrice, max: maxPrice },
            tags,
            search,
            sortBy,
            sortOrder,
          },
        },
        message: `Found ${totalResults} readers`,
      });
    } catch (error: any) {
      console.error("Catalog fetch error:", error);
      res.status(500).json({
        message: "Error fetching readers catalog",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

// @route   POST /api/readers/buy
// @desc    Purchase a reader using credits
// @access  Private
router.post(
  "/buy",
  auth,
  validate(purchaseSchema),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { readerId } = req.body;
      const userId = req.userId!;

      // Find the reader
      const reader = await Reader.findById(readerId);
      if (!reader || !reader.isActive) {
        res.status(404).json({
          message: "Reader not found or not available",
        });
        return;
      }

      // Check if user already owns this reader
      if (req.user!.ownsReader(reader._id)) {
        res.status(400).json({
          message: "You already own this reader",
          reader: {
            id: reader._id,
            title: reader.title,
          },
        });
        return;
      }

      // Check if user has enough credits
      if (req.user!.credits < reader.price) {
        res.status(400).json({
          message: "Insufficient credits",
          required: reader.price,
          available: req.user!.credits,
          shortage: reader.price - req.user!.credits,
        });
        return;
      }

      // Perform the purchase using User model method
      const updatedUser = await req.user!.purchaseReader(
        reader._id,
        reader.price
      );

      // Increment reader download count (even though not downloaded yet)
      await (reader as IReader).incrementDownload();

      res.json({
        success: true,
        message: "Reader purchased successfully!",
        purchase: {
          readerId: reader._id,
          title: reader.title,
          pricePaid: reader.price,
          purchasedAt: new Date(),
        },
        user: {
          creditsRemaining: updatedUser.credits,
          totalPurchases: updatedUser.purchasedReaders.length,
        },
        reader: {
          id: reader._id,
          title: reader.title,
          pages: reader.pages,
          author: reader.author,
        },
      });
    } catch (error: any) {
      console.error("Purchase error:", error);

      if (error.message === "Insufficient credits") {
        res.status(400).json({
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        message: "Error processing purchase",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

// @route   GET /api/readers/download/:id
// @desc    Generate signed download URL for purchased reader
// @access  Private
router.get(
  "/download/:id",
  auth,
  validateObjectId("id"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const readerId = req.params.id;
      const userId = req.userId!;

      // Find the reader
      const reader = await Reader.findById(readerId);
      if (!reader || !reader.isActive) {
        res.status(404).json({
          message: "Reader not found or not available",
        });
        return;
      }

      // Check if user owns this reader
      if (!req.user!.ownsReader(reader._id)) {
        res.status(403).json({
          message: "You don't own this reader. Purchase it first.",
          reader: {
            id: reader._id,
            title: reader.title,
            price: reader.price,
          },
        });
        return;
      }

      // Generate time-limited signed download token (expires in 1 hour)
      const downloadToken = jwt.sign(
        {
          userId,
          readerId: reader._id,
          fileName: reader.fileName,
          purpose: "download",
        },
        process.env.JWT_SECRET || "default-secret",
        { expiresIn: "1h" }
      );

      // Create signed download URL
      const baseUrl =
        process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
      const signedUrl = `${baseUrl}/api/readers/file/${downloadToken}`;

      // Update user's download count for this reader
      const userPurchase = req.user!.purchasedReaders.find(
        (purchase: any) => purchase.readerId.toString() === readerId
      );
      if (userPurchase) {
        userPurchase.downloadCount += 1;
        await req.user!.save();
      }

      res.json({
        success: true,
        message: "Download URL generated successfully",
        download: {
          url: signedUrl,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          expiresIn: "1 hour",
          fileName: reader.fileName,
          fileSize: reader.fileSize,
          downloadCount: userPurchase?.downloadCount || 1,
        },
        reader: {
          id: reader._id,
          title: reader.title,
          pages: reader.pages,
          author: reader.author,
        },
        instructions: [
          "This URL expires in 1 hour",
          "Use this URL to download your purchased reader",
          "Do not share this URL - it's personalized for you",
        ],
      });
    } catch (error: any) {
      console.error("Download URL generation error:", error);
      res.status(500).json({
        message: "Error generating download URL",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

// @route   GET /api/readers/file/:token
// @desc    Serve the actual file using signed token
// @access  Private via signed token
router.get(
  "/file/:token",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;

      // Verify the download token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default-secret"
      ) as {
        userId: string;
        readerId: string;
        fileName: string;
        purpose: string;
      };

      if (decoded.purpose !== "download") {
        res.status(401).json({
          message: "Invalid download token",
        });
        return;
      }

      // Verify user still owns the reader
      const user = await User.findById(decoded.userId);
      const reader = await Reader.findById(decoded.readerId);

      if (!user || !reader || !user.ownsReader(reader._id)) {
        res.status(403).json({
          message: "Access denied - reader ownership verification failed",
        });
        return;
      }

      // For this demo, we'll return a JSON response with file info
      // In production, you'd stream the actual file from storage
      res.json({
        success: true,
        message: "File download ready",
        file: {
          name: reader.fileName,
          title: reader.title,
          size: reader.fileSize,
          pages: reader.pages,
          author: reader.author,
        },
        // In production, you'd set proper headers and stream the file:
        // res.setHeader('Content-Type', 'application/pdf');
        // res.setHeader('Content-Disposition', `attachment; filename="${reader.fileName}"`);
        // return fileStream.pipe(res);
        note: "In production, this would serve the actual PDF file. For demo purposes, this shows file metadata.",
        downloadUrl: reader.fileUrl, // Sample file URL
      });
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        res.status(401).json({
          message: "Download link has expired. Please generate a new one.",
        });
        return;
      }

      if (error.name === "JsonWebTokenError") {
        res.status(401).json({
          message: "Invalid download token",
        });
        return;
      }

      console.error("File download error:", error);
      res.status(500).json({
        message: "Error downloading file",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

// @route   GET /api/readers/library
// @desc    Get user's purchased readers library
// @access  Private
router.get(
  "/library",
  auth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      // Populate user's purchased readers with full reader details
      const user = await User.findById(req.userId).populate({
        path: "purchasedReaders.readerId",
        model: "Reader",
        match: { isActive: true },
      });

      if (!user) {
        res.status(404).json({
          message: "User not found",
        });
        return;
      }

      // Filter out any readers that might have been deleted
      const validPurchases = user.purchasedReaders.filter(
        (purchase: any) => purchase.readerId
      );

      const library = validPurchases.map((purchase: any) => ({
        reader: purchase.readerId,
        purchasedAt: purchase.purchasedAt,
        downloadCount: purchase.downloadCount,
        canDownload: true,
      }));

      res.json({
        success: true,
        data: {
          library,
          totalPurchased: library.length,
          totalDownloads: library.reduce(
            (sum: number, item: any) => sum + item.downloadCount,
            0
          ),
        },
        message: `You have ${library.length} readers in your library`,
      });
    } catch (error: any) {
      console.error("Library fetch error:", error);
      res.status(500).json({
        message: "Error fetching library",
        error: process.env.NODE_ENV === "development" ? error.message : {},
      });
    }
  }
);

export default router;
