// `redirectTo` sends the user to a resource the action created (e.g. the new job).
export type ActionResult<T = undefined> = { ok: true; data?: T; redirectTo?: string } | { ok: false; message: string };
