// `redirectTo` sends the user to a resource the action created (e.g. the new job).
// `jobId` on a failure: the job that blocks the request (e.g. worker_busy).
export type ActionResult<T = undefined> = { ok: true; data?: T; redirectTo?: string } | { ok: false; message: string; jobId?: number };
