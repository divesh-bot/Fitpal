import type { AuthContext } from "../middleware/auth.js";
import type { Repositories } from "../repositories/index.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth after the access token is verified. */
      auth?: AuthContext;
      /** Data access scoped to the authenticated user (set after requireAuth). */
      repos?: Repositories;
    }
  }
}

export {};
