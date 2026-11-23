import { Router } from "express";
import { requireAuth, type TokenVerifier } from "../middleware/auth.js";
import { attachRepositories } from "../middleware/repositories.js";
import type { RepositoriesFactory } from "../repositories/index.js";
import { accountRouter } from "./account.routes.js";
import { foodsRouter } from "./foods.routes.js";
import { recipesRouter } from "./recipes.routes.js";
import { mealPlansRouter } from "./mealPlans.routes.js";
import { trackingRouter } from "./tracking.routes.js";
import { dailyRouter } from "./daily.routes.js";

export interface ApiRouterDeps {
  verifyToken: TokenVerifier;
  repositories: RepositoriesFactory;
}

/**
 * Versioned API router mounted at /api/v1. EVERY route below requires a valid
 * Supabase access token; repositories are then bound to that verified user.
 */
export function createApiRouter({ verifyToken, repositories }: ApiRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(verifyToken), attachRepositories(repositories));

  router.use(accountRouter());
  router.use(foodsRouter());
  router.use(recipesRouter());
  router.use(mealPlansRouter());
  router.use(trackingRouter());
  router.use(dailyRouter());

  return router;
}
