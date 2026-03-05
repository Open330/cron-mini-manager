"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CronJob = {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  managed: boolean;
};

type Theme = "light" | "dark";

type CronJobInput = {
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
};

const initialForm: CronJobInput = {
  name: "",
  schedule: "0 0 * * *",
  command: "",
  enabled: true,
};

const THEME_STORAGE_KEY = "cron-mini-manager-theme";

function resolveThemePreference(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
  } catch {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as { message?: string } & T;
  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed");
  }
  return payload;
}

export default function Home() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [form, setForm] = useState<CronJobInput>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");

  const modeLabel = useMemo(
    () => (editingId ? "Update Cron Job" : "Create Cron Job"),
    [editingId],
  );

  async function loadJobs() {
    setLoading(true);
    try {
      const payload = await apiRequest<{ jobs: CronJob[] }>("/api/jobs", {
        method: "GET",
      });
      setJobs(payload.jobs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  useEffect(() => {
    const nextTheme = resolveThemePreference();
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function handleThemeToggle() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      setTheme(nextTheme);
      return;
    }

    setTheme(nextTheme);
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/api/jobs/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await apiRequest("/api/jobs", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      await loadJobs();
      resetForm();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save job");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(job: CronJob) {
    if (!job.managed) {
      setError("External cron entries are read-only. Copy them to a managed job to edit.");
      return;
    }

    setEditingId(job.id);
    setForm({
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      enabled: job.enabled,
    });
  }

  async function handleToggle(job: CronJob) {
    if (!job.managed) {
      setError("External cron entries are read-only. Managed jobs can be toggled here.");
      return;
    }

    try {
      await apiRequest(`/api/jobs/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !job.enabled }),
      });
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle job");
    }
  }

  async function handleDelete(job: CronJob) {
    if (!job.managed) {
      setError("External cron entries are read-only. Managed jobs can be deleted here.");
      return;
    }

    if (!window.confirm(`Delete '${job.name}'?`)) {
      return;
    }

    try {
      await apiRequest(`/api/jobs/${job.id}`, {
        method: "DELETE",
      });
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job");
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 text-slate-900 dark:text-slate-100 md:px-10">
      <header className="mb-8 rounded-2xl border border-blue-100 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-blue-600 uppercase dark:text-blue-300">
              Cron Mini Manager
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Manage macOS cron jobs from your browser
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300 md:text-base">
              Managed jobs can be edited in place. Existing cron entries outside
              this app&apos;s managed block are also shown below as read-only.
            </p>
          </div>

          <button
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            type="button"
            onClick={handleThemeToggle}
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/85">
          <h2 className="text-lg font-semibold">{modeLabel}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            Schedule format accepts 5 fields (minute hour day month weekday) or
            macros like @reboot.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950/75 dark:text-slate-100 dark:ring-blue-400"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Nightly README update"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Schedule
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950/75 dark:text-slate-100 dark:ring-blue-400"
                value={form.schedule}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, schedule: event.target.value }))
                }
                placeholder="0 0 * * *"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              Command
              <textarea
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950/75 dark:text-slate-100 dark:ring-blue-400"
                value={form.command}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, command: event.target.value }))
                }
                placeholder="/Users/hletrd/git/open330/scripts/run-profile-cron.sh"
                required
              />
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, enabled: event.target.checked }))
                }
              />
              Enabled
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:disabled:bg-blue-900"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Saving..." : modeLabel}
              </button>
              {editingId ? (
                <button
                  className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/85">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cron Jobs</h2>
            <button
              className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => void loadJobs()}
              type="button"
            >
              Refresh
            </button>
          </div>

          {error ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/80 dark:bg-red-950/60 dark:text-red-200">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">Loading jobs...</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              No cron jobs found. Create one from the form.
            </p>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{job.name}</p>
                      <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-200">
                        {job.schedule}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-300">
                        {job.command}
                      </p>
                      {!job.managed ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          External entry (read-only)
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          job.enabled
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {job.enabled ? "Enabled" : "Disabled"}
                      </span>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          job.managed
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/55 dark:text-blue-200"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200"
                        }`}
                      >
                        {job.managed ? "Managed" : "External"}
                      </span>
                    </div>
                  </div>

                  {job.managed ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        type="button"
                        onClick={() => handleEdit(job)}
                      >
                        Edit
                      </button>
                      <button
                        className="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900/70"
                        type="button"
                        onClick={() => void handleToggle(job)}
                      >
                        {job.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-900/80 dark:bg-red-950/60 dark:text-red-200 dark:hover:bg-red-900/70"
                        type="button"
                        onClick={() => void handleDelete(job)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
