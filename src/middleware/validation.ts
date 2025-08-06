import { Request, Response, NextFunction } from "express";
import Joi from "joi";

// Validation schemas
const leagueEntrySchema = Joi.object({
  leagueId: Joi.string().required().messages({
    "any.required": "League ID is required",
  }),
});

const scoreSubmissionSchema = Joi.object({
  leagueId: Joi.string().required().messages({
    "any.required": "League ID is required",
  }),
  accuracy: Joi.number().min(0).max(100).required().messages({
    "number.min": "Accuracy must be at least 0",
    "number.max": "Accuracy cannot exceed 100",
    "any.required": "Accuracy is required",
  }),
  timeInSeconds: Joi.number().min(0).required().messages({
    "number.min": "Time must be a positive number",
    "any.required": "Time is required",
  }),
  points: Joi.number().min(0).required().messages({
    "number.min": "Points must be a positive number",
    "any.required": "Points are required",
  }),
  gameData: Joi.object({
    questionsAnswered: Joi.number().min(0),
    correctAnswers: Joi.number().min(0),
    gameMode: Joi.string(),
    difficulty: Joi.string(),
  }).optional(),
});

// Generic validation middleware function - ADDED THIS EXPORT!
export const validate = (
  schema: Joi.ObjectSchema,
  property: keyof Request = "body"
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errorMessages = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      res.status(400).json({
        message: "Validation error",
        errors: errorMessages,
      });
      return;
    }

    // Replace the original data with validated data
    (req as any)[property] = value;
    next();
  };
};

// Custom validation for MongoDB ObjectId
export const validateObjectId = (paramName: string = "id") => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params[paramName];

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({
        message: `Invalid ${paramName} format`,
      });
      return;
    }

    next();
  };
};

// Specific validation middleware exports
export const validateLeagueEntry = validate(leagueEntrySchema);
export const validateScoreSubmission = validate(scoreSubmissionSchema);

export default {
  validate, // ADDED TO DEFAULT EXPORT TOO
  validateLeagueEntry,
  validateScoreSubmission,
  validateObjectId,
};
