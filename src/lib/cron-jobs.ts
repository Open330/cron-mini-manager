import "server-only";

import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const BEGIN_MARKER = "# BEGIN CRON_MINI_MANAGER";
const END_MARKER = "# END CRON_MINI_MANAGER";
const JOB_PREFIX = "# JOB ";

const CRON_MACROS = new Set([
  "@reboot",
  "@yearly",
  "@annually",
  "@monthly",
  "@weekly",
  "@daily",
  "@midnight",
  "@hourly",
]);

export type CronJob = {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  managed: boolean;
};

export type CronJobInput = {
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
};

type ManagedBlock = {
  before: string[];
  after: string[];
  jobs: CronJob[];
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isValidSchedule(schedule: string): boolean {
  const normalized = normalizeWhitespace(schedule);
  if (normalized.startsWith("@")) {
    return CRON_MACROS.has(normalized.toLowerCase());
  }

  const fields = normalized.split(" ");
  return fields.length === 5;
}

function parseScheduleAndCommand(line: string): { schedule: string; command: string } | null {
  const normalized = normalizeWhitespace(line);
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("@")) {
    const [schedule, ...rest] = normalized.split(" ");
    if (!schedule || rest.length === 0) {
      return null;
    }
    return {
      schedule,
      command: rest.join(" "),
    };
  }

  const tokens = normalized.split(" ");
  if (tokens.length < 6) {
    return null;
  }

  return {
    schedule: tokens.slice(0, 5).join(" "),
    command: tokens.slice(5).join(" "),
  };
}

export function parseCronJobInput(payload: unknown): CronJobInput {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload");
  }

  const data = payload as Record<string, unknown>;
  const name = String(data.name ?? "").trim();
  const schedule = normalizeWhitespace(String(data.schedule ?? ""));
  const command = String(data.command ?? "").trim();
  const enabled = Boolean(data.enabled);

  if (!name) {
    throw new Error("Name is required");
  }
  if (!schedule) {
    throw new Error("Schedule is required");
  }
  if (!isValidSchedule(schedule)) {
    throw new Error("Schedule must have 5 cron fields or use a supported macro");
  }
  if (!command) {
    throw new Error("Command is required");
  }

  return {
    name,
    schedule,
    command,
    enabled,
  };
}

async function readCrontabRaw(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("crontab", ["-l"]);
    return stdout.replace(/\r\n/g, "\n");
  } catch (error) {
    const message = toErrorMessage(error);
    if (message.includes("no crontab") || message.includes("no crontab for")) {
      return "";
    }
    throw new Error(`Failed to read crontab: ${message}`);
  }
}

async function writeCrontabRaw(contents: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("crontab", ["-"], { stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || "crontab command failed"));
      }
    });

    child.stdin.write(contents);
    child.stdin.end();
  });
}

function splitLines(raw: string): string[] {
  const lines = raw.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function parseManagedBlock(raw: string): ManagedBlock {
  const lines = splitLines(raw);
  const beginIndex = lines.findIndex((line) => line.trim() === BEGIN_MARKER);
  const endIndex = lines.findIndex((line, index) => index > beginIndex && line.trim() === END_MARKER);

  if (beginIndex === -1 || endIndex === -1 || endIndex <= beginIndex) {
    return {
      before: lines,
      after: [],
      jobs: [],
    };
  }

  const before = lines.slice(0, beginIndex);
  const blockLines = lines.slice(beginIndex + 1, endIndex);
  const after = lines.slice(endIndex + 1);

  const jobs: CronJob[] = [];
  for (let i = 0; i < blockLines.length; i += 1) {
    const metadataLine = blockLines[i].trim();
    if (!metadataLine.startsWith(JOB_PREFIX)) {
      continue;
    }

    const metadataRaw = metadataLine.slice(JOB_PREFIX.length).trim();
    let metadata: Partial<CronJob> & { id?: string; name?: string };
    try {
      metadata = JSON.parse(metadataRaw) as Partial<CronJob> & {
        id?: string;
        name?: string;
      };
    } catch {
      continue;
    }

    const jobLine = blockLines[i + 1];
    if (!jobLine) {
      continue;
    }
    i += 1;

    const disabledLine = jobLine.trim().startsWith("#");
    const executable = disabledLine
      ? normalizeWhitespace(jobLine.trim().replace(/^#\s?/, ""))
      : normalizeWhitespace(jobLine);

    const parsed = parseScheduleAndCommand(executable);
    if (!parsed || !metadata.id || !metadata.name) {
      continue;
    }

    const now = new Date().toISOString();
    jobs.push({
      id: metadata.id,
      name: String(metadata.name),
      schedule: parsed.schedule,
      command: parsed.command,
      enabled: disabledLine ? false : metadata.enabled !== false,
      createdAt:
        typeof metadata.createdAt === "string" && metadata.createdAt
          ? metadata.createdAt
          : now,
      updatedAt:
        typeof metadata.updatedAt === "string" && metadata.updatedAt
          ? metadata.updatedAt
          : now,
      managed: true,
    });
  }

  return { before, after, jobs };
}

function parseExternalJobs(lines: string[], scope: "before" | "after"): CronJob[] {
  const now = new Date().toISOString();
  const jobs: CronJob[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const disabledLine = trimmed.startsWith("#");
    const executable = disabledLine
      ? normalizeWhitespace(trimmed.replace(/^#\s?/, ""))
      : normalizeWhitespace(trimmed);

    const parsed = parseScheduleAndCommand(executable);
    if (!parsed) {
      return;
    }

    jobs.push({
      id: `external-${scope}-${index}`,
      name: `External Job ${jobs.length + 1}`,
      schedule: parsed.schedule,
      command: parsed.command,
      enabled: !disabledLine,
      createdAt: now,
      updatedAt: now,
      managed: false,
    });
  });

  return jobs;
}

function renderManagedBlock(jobs: CronJob[]): string[] {
  const lines: string[] = [BEGIN_MARKER];

  for (const job of jobs) {
    const metadata = {
      id: job.id,
      name: job.name,
      enabled: job.enabled,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };

    lines.push(`${JOB_PREFIX}${JSON.stringify(metadata)}`);
    const executable = `${normalizeWhitespace(job.schedule)} ${job.command.trim()}`;
    lines.push(job.enabled ? executable : `# ${executable}`);
  }

  lines.push(END_MARKER);
  return lines;
}

function mergeCrontab(before: string[], jobs: CronJob[], after: string[]): string {
  const lines: string[] = [...before];

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length > 0) {
    lines.push("");
  }

  lines.push(...renderManagedBlock(jobs));

  const cleanedAfter = [...after];
  while (cleanedAfter.length > 0 && cleanedAfter[0] === "") {
    cleanedAfter.shift();
  }

  if (cleanedAfter.length > 0) {
    lines.push("");
    lines.push(...cleanedAfter);
  }

  return `${lines.join("\n")}\n`;
}

async function saveJobs(block: ManagedBlock, jobs: CronJob[]): Promise<void> {
  const nextCrontab = mergeCrontab(block.before, jobs, block.after);
  await writeCrontabRaw(nextCrontab);
}

export async function listCronJobs(): Promise<CronJob[]> {
  const raw = await readCrontabRaw();
  const block = parseManagedBlock(raw);
  const managedJobs = [...block.jobs].sort((a, b) => a.name.localeCompare(b.name));
  const unmanagedJobs = [
    ...parseExternalJobs(block.before, "before"),
    ...parseExternalJobs(block.after, "after"),
  ];

  return [...managedJobs, ...unmanagedJobs];
}

export async function createCronJob(input: CronJobInput): Promise<CronJob> {
  const raw = await readCrontabRaw();
  const block = parseManagedBlock(raw);

  const now = new Date().toISOString();
  const job: CronJob = {
    id: randomUUID(),
    name: input.name,
    schedule: input.schedule,
    command: input.command,
    enabled: input.enabled,
    createdAt: now,
    updatedAt: now,
    managed: true,
  };

  await saveJobs(block, [...block.jobs, job]);
  return job;
}

export async function updateCronJob(id: string, input: CronJobInput): Promise<CronJob> {
  const raw = await readCrontabRaw();
  const block = parseManagedBlock(raw);
  const now = new Date().toISOString();

  let updated: CronJob | null = null;
  const next = block.jobs.map((job) => {
    if (job.id !== id) {
      return job;
    }

    updated = {
      ...job,
      name: input.name,
      schedule: input.schedule,
      command: input.command,
      enabled: input.enabled,
      updatedAt: now,
    };
    return updated;
  });

  if (!updated) {
    throw new Error("Job not found");
  }

  await saveJobs(block, next);
  return updated;
}

export async function setCronJobEnabled(id: string, enabled: boolean): Promise<CronJob> {
  const raw = await readCrontabRaw();
  const block = parseManagedBlock(raw);
  const now = new Date().toISOString();

  let updated: CronJob | null = null;
  const next = block.jobs.map((job) => {
    if (job.id !== id) {
      return job;
    }
    updated = {
      ...job,
      enabled,
      updatedAt: now,
    };
    return updated;
  });

  if (!updated) {
    throw new Error("Job not found");
  }

  await saveJobs(block, next);
  return updated;
}

export async function removeCronJob(id: string): Promise<void> {
  const raw = await readCrontabRaw();
  const block = parseManagedBlock(raw);
  const next = block.jobs.filter((job) => job.id !== id);

  if (next.length === block.jobs.length) {
    throw new Error("Job not found");
  }

  await saveJobs(block, next);
}
