import type { RequestHandler } from "express";
import type { Repositories, RepositoriesFactory } from "../repositories/index.js";
import { AppError } from "../utils/AppError.js";
import { getAuth } from "./auth.js";

/** Must run after requireAuth: creates repositories bound to the verified user. */
export function attachRepositories(factory: RepositoriesFactory): RequestHandler {
  return (req, _res, next) => {
    const { userId, accessToken } = getAuth(req);
    req.repos = factory({ userId, accessToken });
    next();
  };
}

export function getRepos(req: { repos?: Repositories }): Repositories {
  if (!req.repos) throw AppError.unauthorized();
  return req.repos;
}
