import { Router } from "express";
import * as c from "../controllers/grocery.controller.js";

export function groceryRouter(): Router {
  const r = Router();
  r.get("/grocery-lists/current", c.current);
  r.post("/grocery-lists/current/items", c.addItem);
  r.post("/grocery-lists/current/uncheck-all", c.uncheckAll);
  r.post("/grocery-lists/generate", c.generate); // from the active meal plan
  r.put("/grocery-items/:id", c.updateItem); // { name?, quantityLabel?, isPurchased? }
  r.delete("/grocery-items/:id", c.deleteItem);
  return r;
}
