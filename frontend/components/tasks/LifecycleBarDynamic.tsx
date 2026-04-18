/** Status-driven lifecycle strip for a single task (task detail). */

type Props = { status: string };

const LABELS = ["Published", "Accepted", "In progress", "Submitted", "Verifying", "Completed"] as const;

/**
 * Index of the first stage not yet done: stages before it are complete; that stage is "active";
 * later stages are todo. `completed` marks all stages done.
 */
function firstIncompleteIndex(status: string): number | "all" {
  const s = status.toLowerCase();
  if (s === "completed") return "all";
  const m: Record<string, number> = {
    published: 1,
    accepted: 2,
    in_progress: 3,
    submitted: 4,
    verifying: 5,
    verified: 5,
  };
  return m[s] ?? 1;
}

export function LifecycleBarDynamic({ status }: Props) {
  const fi = firstIncompleteIndex(status);
  const s = status.toLowerCase();
  const isTerminal =
    s === "disputed" || s === "rejected" || s === "expired" || s === "cancelled" || s === "refunded";

  if (isTerminal) {
    return (
      <div className="dashboard-reveal dashboard-reveal-d3 mb-6 rounded-2xl border border-[color:color-mix(in_oklab,var(--danger)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--danger)_10%,var(--card))] px-4 py-3 text-sm text-[color:var(--danger)]">
        Task status: <span className="font-semibold capitalize">{status.replace(/_/g, " ")}</span>
      </div>
    );
  }

  return (
    <div className="dashboard-reveal dashboard-reveal-d3 mb-6 flex min-w-0 items-center overflow-x-auto rounded-2xl border border-[color:var(--line)] bg-[color:var(--bg-2)] px-4 py-4 sm:px-5">
      {LABELS.map((label, i) => {
        let state: "done" | "active" | "todo";
        if (fi === "all") {
          state = "done";
        } else if (i < fi) {
          state = "done";
        } else if (i === fi) {
          state = "active";
        } else {
          state = "todo";
        }

        const showCheck = state === "done";
        const n = i + 1;

        return (
          <div key={label} className="flex min-w-[72px] flex-1 items-center">
            <div className="flex w-full flex-col items-center text-center">
              <div
                className={`mb-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                  state === "done"
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--ed-on-accent)]"
                    : state === "active"
                      ? "border-[color:var(--accent)] bg-[color:color-mix(in_oklab,var(--accent)_18%,var(--card))] text-[color:var(--accent)]"
                      : "border-[color:var(--line)] text-[color:var(--mute)]"
                }`}
              >
                {showCheck ? "✓" : n}
              </div>
              <div
                className={`text-[10px] font-semibold leading-tight ${
                  state === "active" || state === "done"
                    ? "text-[color:var(--accent)]"
                    : "text-[color:var(--mute)]"
                }`}
              >
                {label}
              </div>
            </div>
            {i < LABELS.length - 1 ? (
              <div
                className={`mb-5 h-0.5 w-6 shrink-0 sm:w-10 ${
                  fi === "all" || (typeof fi === "number" && fi > i)
                    ? "bg-[color:var(--accent)]"
                    : "bg-[color:var(--line)]"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
