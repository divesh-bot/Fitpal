import { Router } from "express";

/**
 * Versioned API router mounted at /api/v1. Feature routers (profile, foods,
 * food-entries, meal-plans, …) are registered here as they are built in
 * Phase 3. Every one of them will sit behind the authentication middleware.
 */
export function createApiRouter(): Router {
  const router = Router();
  return router;
}
