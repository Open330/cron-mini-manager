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
};

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
    setEditingId(job.id);
    setForm({
      name: job.name,
      schedule: job.schedule,
      command: job.command,
      enabled: job.enabled,
    });
  }

  async function handleToggle(job: CronJob) {
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
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 text-slate-900 md:px-10">
      <header className="mb-8 rounded-2xl border border-blue-100 bg-white/90 p-6 shadow-sm backdrop-blur">
        <p className="text-sm font-semibold tracking-[0.2em] text-blue-600 uppercase">
          Cron Mini Manager
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Manage macOS cron jobs from your browser
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
          This dashboard reads and updates your user crontab directly on this Mac
          mini. It manages jobs inside a dedicated block, so existing non-managed
          cron entries are preserved.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{modeLabel}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Schedule format accepts 5 fields (minute hour day month weekday) or
            macros like @reboot.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Nightly README update"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Schedule
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-blue-500 focus:ring-2"
                value={form.schedule}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, schedule: event.target.value }))
                }
                placeholder="0 0 * * *"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Command
              <textarea
                className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-blue-500 focus:ring-2"
                value={form.command}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, command: event.target.value }))
                }
                placeholder="/Users/hletrd/git/open330/scripts/run-profile-cron.sh"
                required
              />
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
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
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                type="submit"
                disabled={submitting}
              >
                {submitting ? "Saving..." : modeLabel}
              </button>
              {editingId ? (
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  type="button"
                  onClick={resetForm}
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Managed Jobs</h2>
            <button
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={() => void loadJobs()}
              type="button"
            >
              Refresh
            </button>
          </div>

          {error ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-500">Loading jobs...</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-slate-500">
              No managed jobs yet. Create one from the form.
            </p>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{job.name}</p>
                      <p className="mt-1 font-mono text-sm text-slate-700">
                        {job.schedule}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-600">
                        {job.command}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        job.enabled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {job.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                      type="button"
                      onClick={() => handleEdit(job)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                      type="button"
                      onClick={() => void handleToggle(job)}
                    >
                      {job.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                      type="button"
                      onClick={() => void handleDelete(job)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
