import { Router } from "express";
import { getHeroes } from "@/handlers/heroes";

export const heroesRouter = Router();

heroesRouter.get("/", getHeroes);
