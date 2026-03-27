import { Response } from "express";

export function sendJson(res: Response, status: number, data: unknown) {
  res.status(status).json(data);
}

export function sendNoContent(res: Response) {
  res.status(204).send();
}
