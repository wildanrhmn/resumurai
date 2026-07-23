import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

interface Stored {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  expiresAt: number;
}

const store = new Map<string, Stored>();
const TTL = () => Number(process.env.ARTIFACT_TTL_MS ?? 1_800_000); // 30 min

function sweep(): void {
  const now = Date.now();
  for (const [id, a] of store) if (a.expiresAt <= now) store.delete(id);
}

export function putArtifact(filename: string, mimeType: string, buffer: Buffer): { id: string; url: string } {
  sweep();
  const id = randomUUID();
  store.set(id, { filename, mimeType, buffer, expiresAt: Date.now() + TTL() });
  return { id, url: `/artifacts/${id}` };
}

/** Express handler for GET /artifacts/:id */
export function artifactHandler(req: Request, res: Response): void {
  sweep();
  const a = store.get(String(req.params.id));
  if (!a) {
    res.status(404).json({ error: "Artifact not found or expired." });
    return;
  }
  res.setHeader("Content-Type", a.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${a.filename}"`);
  res.setHeader("Cache-Control", "private, max-age=600");
  res.send(a.buffer);
}
