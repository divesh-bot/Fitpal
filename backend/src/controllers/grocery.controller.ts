import type { Request, Response } from "express";
import { z } from "zod";
import { getRepos } from "../middleware/repositories.js";
import * as g from "../services/grocery.service.js";
import { nonEmpty, optionalText, parse } from "../validators/common.js";
import { idParamSchema } from "../validators/foods.validators.js";

const addSchema = z.object({ name: z.string().trim().min(1).max(120), quantityLabel: optionalText(60) }).strict();
const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    quantityLabel: optionalText(60),
    isPurchased: z.boolean().optional(),
  })
  .strict()
  .refine(nonEmpty, "Provide at least one field to update");
const generateSchema = z.object({ name: z.string().trim().min(1).max(120).optional() }).strict();

export async function current(req: Request, res: Response) {
  res.json({ data: await g.getCurrentList(getRepos(req).grocery) });
}
export async function addItem(req: Request, res: Response) {
  res.status(201).json({ data: await g.addItem(getRepos(req).grocery, parse(addSchema, req.body)) });
}
export async function updateItem(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  res.json({ data: await g.updateItem(getRepos(req).grocery, id, parse(updateSchema, req.body)) });
}
export async function deleteItem(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  await g.deleteItem(getRepos(req).grocery, id);
  res.status(204).end();
}
export async function uncheckAll(req: Request, res: Response) {
  res.json({ data: await g.uncheckAll(getRepos(req).grocery) });
}
export async function generate(req: Request, res: Response) {
  const { name } = parse(generateSchema, req.body ?? {});
  res.json({ data: await g.generateFromPlan(getRepos(req), name) });
}
