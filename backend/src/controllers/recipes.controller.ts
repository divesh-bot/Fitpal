import type { Request, Response } from "express";
import { getRepos } from "../middleware/repositories.js";
import * as recipes from "../services/recipes.service.js";
import { parse } from "../validators/common.js";
import { idParamSchema } from "../validators/foods.validators.js";
import { recipeListSchema, recipeSaveSchema } from "../validators/recipes.validators.js";

export async function list(req: Request, res: Response) {
  const { category } = parse(recipeListSchema, req.query);
  res.json({ data: await recipes.listRecipes(getRepos(req).recipes, category) });
}

export async function get(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  res.json({ data: await recipes.getRecipe(getRepos(req).recipes, id) });
}

export async function create(req: Request, res: Response) {
  const input = parse(recipeSaveSchema, req.body);
  res.status(201).json({ data: await recipes.saveRecipe(getRepos(req), null, input) });
}

export async function replace(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  const input = parse(recipeSaveSchema, req.body);
  res.json({ data: await recipes.saveRecipe(getRepos(req), id, input) });
}

export async function remove(req: Request, res: Response) {
  const { id } = parse(idParamSchema, req.params);
  await recipes.deleteRecipe(getRepos(req).recipes, id);
  res.status(204).end();
}
