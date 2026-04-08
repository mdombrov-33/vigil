import { Request, Response } from "express";
import { sendJson } from "@/utils/response";
import { getAllHeroes } from "@/db/queries/heroes.js";

export async function getHeroes(_req: Request, res: Response) {
  const result = await getAllHeroes();
  sendJson(res, 200, result);
}
