import type { Request, Response } from "express";
import { getRepos } from "../middleware/repositories.js";
import * as foods from "../services/foods.service.js";
import { parse } from "../validators/common.js";
import { foodCreateSchema, foodSearchSchema, foodUpdateSchema, idParamSchema } from "../validators/foods.validators.js";

export async function search(req: Request, res: Response) {
  const params = parse(foodSearchSchema, req.query);
  const r = getRepos(req);
  res.json({ data: await foods.searchFoods(r.foods, r.account, params) });
}

export async function get(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  const r = getRepos(req);
  res.json({ data: await foods.getFood(r.foods, r.account, id) });
}

export async function create(req: Request, res: Response) {
  const input = parse(foodCreateSchema, req.body);
  const r = getRepos(req);
  res.status(201).json({ data: await foods.createFood(r.foods, r.account, input) });
}

export async function update(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  const input = parse(foodUpdateSchema, req.body);
  const r = getRepos(req);
  res.json({ data: await foods.updateFood(r.foods, r.account, id, input) });
}

export async function remove(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  await foods.deleteFood(getRepos(req).foods, id);
  res.status(204).end();
}
