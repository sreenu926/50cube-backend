import mongoose, { Schema, Types } from "mongoose";

// Reader interface
export interface IReader extends mongoose.Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  pages: number;
  price: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  author: string;
  tags: string[];
  downloadCount: number;
  rating: number;
  reviews: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  incrementDownload(): Promise<IReader>;
}

// Static methods interface
export interface IReaderModel extends mongoose.Model<IReader> {
  getPopular(limit?: number): mongoose.Aggregate<any[]>;
  searchReaders(
    query: {
      subject?: string;
      difficulty?: string;
      minPrice?: number;
      maxPrice?: number;
      tags?: string[];
      search?: string;
    },
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }
  ): mongoose.Aggregate<any[]>;
}

const readerSchema = new Schema<IReader>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    subject: {
      type: String,
      required: true,
      enum: ["math", "science", "english", "general"],
      lowercase: true,
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["beginner", "intermediate", "advanced"],
      lowercase: true,
    },
    pages: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    author: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
readerSchema.index({ subject: 1 });
readerSchema.index({ difficulty: 1 });
readerSchema.index({ price: 1 });
readerSchema.index({ rating: -1 });
readerSchema.index({ downloadCount: -1 });
readerSchema.index({ isActive: 1 });
readerSchema.index({ tags: 1 });

// Virtual for popularity score
readerSchema.virtual("popularityScore").get(function () {
  return this.downloadCount * 0.7 + this.rating * this.reviews * 0.3;
});

// Method to increment download count
readerSchema.methods.incrementDownload = async function (): Promise<IReader> {
  this.downloadCount += 1;
  return this.save();
};

// Static method to get popular readers
readerSchema.statics.getPopular = function (limit: number = 10) {
  return this.aggregate([
    { $match: { isActive: true } },
    {
      $addFields: {
        popularityScore: {
          $add: [
            { $multiply: ["$downloadCount", 0.7] },
            { $multiply: [{ $multiply: ["$rating", "$reviews"] }, 0.3] },
          ],
        },
      },
    },
    { $sort: { popularityScore: -1 } },
    { $limit: limit },
  ]);
};

// Static method to search readers
readerSchema.statics.searchReaders = function (
  query: {
    subject?: string;
    difficulty?: string;
    minPrice?: number;
    maxPrice?: number;
    tags?: string[];
    search?: string;
  },
  options: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {}
) {
  const {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const matchConditions: any = { isActive: true };

  // Add filters
  if (query.subject) matchConditions.subject = query.subject;
  if (query.difficulty) matchConditions.difficulty = query.difficulty;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    matchConditions.price = {};
    if (query.minPrice !== undefined)
      matchConditions.price.$gte = query.minPrice;
    if (query.maxPrice !== undefined)
      matchConditions.price.$lte = query.maxPrice;
  }
  if (query.tags && query.tags.length > 0) {
    matchConditions.tags = { $in: query.tags };
  }
  if (query.search) {
    matchConditions.$or = [
      { title: { $regex: query.search, $options: "i" } },
      { description: { $regex: query.search, $options: "i" } },
      { author: { $regex: query.search, $options: "i" } },
    ];
  }

  const pipeline = [
    { $match: matchConditions },
    {
      $addFields: {
        popularityScore: {
          $add: [
            { $multiply: ["$downloadCount", 0.7] },
            { $multiply: [{ $multiply: ["$rating", "$reviews"] }, 0.3] },
          ],
        },
      },
    },
    {
      $sort: {
        [sortBy === "popularity" ? "popularityScore" : sortBy]:
          sortOrder === "desc" ? -1 : 1,
      },
    },
    {
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        metadata: [{ $count: "total" }],
      },
    },
  ];

  return this.aggregate(pipeline as any[]);
};

export const Reader = mongoose.model<IReader>("Reader", readerSchema);
export default Reader;
