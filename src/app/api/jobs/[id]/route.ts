import { NextResponse } from "next/server";

import {
  parseCronJobInput,
  removeCronJob,
  setCronJobEnabled,
  updateCronJob,
} from "@/lib/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ message }, { status: 400 });
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const payload = (await request.json()) as unknown;
    const input = parseCronJobInput(payload);
    const { id } = await context.params;
    const job = await updateCronJob(id, input);
    return NextResponse.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const payload = (await request.json()) as { enabled?: unknown };
    if (typeof payload.enabled !== "boolean") {
      throw new Error("enabled must be a boolean");
    }
    const { id } = await context.params;
    const job = await setCronJobEnabled(id, payload.enabled);
    return NextResponse.json({ job });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await removeCronJob(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
