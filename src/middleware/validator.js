// Validation middleware for API requests
const { z } = require('zod');

// Zod schemas for validation
const storySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  language: z.enum(['en', 'hi', 'es', 'fr', 'de', 'it', 'pt']),
  genre: z.enum(['romance', 'mystery', 'drama', 'fantasy', 'thriller', 'comedy', 'horror', 'slice-of-life', 'sci-fi', 'historical']),
  episode: z.number().min(1).max(100),
  audioUrl: z.string().url(),
  duration: z.number().min(1).max(1800), // max 30 minutes
  characterCount: z.number().min(0).max(10000),
  wordCount: z.number().min(0).max(8000),
  rating: z.number().min(0).max(5).optional(),
  plays: z.number().min(0).default(0),
  isPremium: z.boolean().default(false),
  status: z.enum(['active', 'draft', 'archived']).default('active'),
  tags: z.array(z.string()).optional(),
  author: z.string().optional()
});

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
  language: z.enum(['en', 'hi', 'es', 'fr', 'de', 'it', 'pt']).default('en')
});

const ratingSchema = z.object({
  rating: z.number().min(1).max(5),
  review: z.string().max(500).optional()
});

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.body);
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

// Request validators
const validateStory = validate(storySchema);
const validateUser = validate(userSchema);
const validateRating = validate(ratingSchema);

// Query parameter validation
const validateQueryParams = (params) => {
  return (req, res, next) => {
    try {
      const validatedParams = {};
      for (const [key, schema] of Object.entries(params)) {
        const value = req.query[key];
        if (value !== undefined) {
          validatedParams[key] = schema.parse(value);
        }
      }
      req.validatedQuery = validatedParams;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
};

const validatePagination = validateQueryParams({
  limit: z.number().min(1).max(100).default(20),
  skip: z.number().min(0).default(0)
});

const validateSort = validateQueryParams({
  sortBy: z.enum(['createdAt', 'plays', 'rating', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

module.exports = {
  validate,
  validateStory,
  validateUser,
  validateRating,
  validatePagination,
  validateSort
};