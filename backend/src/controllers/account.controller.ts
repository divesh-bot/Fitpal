import type { Request, Response } from "express";
import { getAuth } from "../middleware/auth.js";
import { getRepos } from "../middleware/repositories.js";
import * as account from "../services/account.service.js";
import { parse } from "../validators/common.js";
import {
  effectiveFromParamSchema,
  preferencesUpdateSchema,
  profileUpdateSchema,
  targetsInputSchema,
  targetsQuerySchema,
} from "../validators/account.validators.js";

/** Controllers only translate HTTP <-> service calls. */

export async function getProfile(req: Request, res: Response) {
  res.json({ data: await account.getProfile(getRepos(req).account, getAuth(req).email) });
}

export async function updateProfile(req: Request, res: Response) {
  const input = parse(profileUpdateSchema, req.body);
  res.json({ data: await account.updateProfile(getRepos(req).account, input, getAuth(req).email) });
}

export async function getTargets(req: Request, res: Response) {
  const { date } = parse(targetsQuerySchema, req.query);
  res.json({ data: await account.getTargetsOn(getRepos(req).account, date) });
}

export async function listTargets(req: Request, res: Response) {
  res.json({ data: await account.listTargets(getRepos(req).account) });
}

export async function setTargets(req: Request, res: Response) {
  const { effectiveFrom } = parse(effectiveFromParamSchema, req.params);
  const input = parse(targetsInputSchema, req.body);
  res.json({ data: await account.setTargets(getRepos(req).account, effectiveFrom, input) });
}

export async function getPreferences(req: Request, res: Response) {
  res.json({ data: await account.getPreferences(getRepos(req).account) });
}

export async function updatePreferences(req: Request, res: Response) {
  const input = parse(preferencesUpdateSchema, req.body);
  res.json({ data: await account.updatePreferences(getRepos(req).account, input) });
}
