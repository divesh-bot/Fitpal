import { Router } from "express";
import { requireAuth, type TokenVerifier } from "../middleware/auth.js";
import { attachRepositories } from "../middleware/repositories.js";
import type { RepositoriesFactory } from "../repositories/index.js";
import { userRateLimiter } from "../middleware/security.js";
import type { Env } from "../config/env.js";
import { accountRouter } from "./account.routes.js";
import { foodsRouter } from "./foods.routes.js";
import { recipesRouter } from "./recipes.routes.js";
import { mealPlansRouter } from "./mealPlans.routes.js";
import { trackingRouter } from "./tracking.routes.js";
import { dailyRouter } from "./daily.routes.js";
import { workoutsRouter } from "./workouts.routes.js";
import { groceryRouter } from "./grocery.routes.js";

export interface ApiRouterDeps {
  verifyToken: TokenVerifier;
  repositories: RepositoriesFactory;
  env: Pick<Env, "RATE_LIMIT_WINDOW_MS" | "RATE_LIMIT_MAX">;
}

/**
 * Versioned API router mounted at /api/v1. EVERY route below requires a valid
 * Supabase access token; repositories are then bound to that verified user.
 */
export function createApiRouter({ verifyToken, repositories, env }: ApiRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(verifyToken), userRateLimiter(env), attachRepositories(repositories));

  router.use(accountRouter());
  router.use(foodsRouter());
  router.use(recipesRouter());
  router.use(mealPlansRouter());
  router.use(trackingRouter());
  router.use(dailyRouter());
  router.use(workoutsRouter());
  router.use(groceryRouter());

  return router;
}
