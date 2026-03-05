import { NextResponse } from "next/server";

import {
  createCronJob,
  listCronJobs,
  parseCronJobInput,
} from "@/lib/cron-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Internal server error";
  return NextResponse.json({ message }, { status: 400 });
}

export async function GET() {
  try {
    const jobs = await listCronJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const input = parseCronJobInput(payload);
    const job = await createCronJob(input);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
