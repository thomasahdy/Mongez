import { useState, useEffect } from "react";
import { useOutletContext } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import approvalsService from "../../services/api/approvalsService";
import { useAppContext } from "../AppContext";

let path = [
  {
    name: "Workspace",
    color: "text-slate-400",
    ref: "/dashboard"
  },
  {
    name: "Approvals Hub",
    color: "text-slate-800",
    ref: ""
  },
];

export default function ApprovalsPage() {
  const { setPath } = useOutletContext() || {};
  const queryClient = useQueryClient();
  const { user } = useAppContext();
  const [notes, setNotes] = useState({});

  useEffect(() => {
    setPath?.(path);
  }, [setPath]);

  // Fetch pending approvals for the current user
  const { data: approvalsData, isLoading, isError, error } = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: () => approvalsService.getPending(),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, decision, note }) =>
      approvalsService.resolve(id, { status: decision, reason: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const handleResolve = async (id, decision) => {
    const note = notes[id] || "";
    try {
      await resolveMutation.mutateAsync({ id, decision, note });
      // Clear notes input for this approval item
      setNotes((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (err) {
      console.error("Failed to resolve approval:", err);
    }
  };

  const pendingApprovals = approvalsData?.data || approvalsData?.items || approvalsData || [];

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2">
          <svg className="h-8 w-8 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-slate-500">Loading pending approvals...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 max-w-md">
          <h3 className="font-bold text-lg mb-2">Failed to load approvals</h3>
          <p className="text-sm">{error?.message || "Approvals service is temporarily unavailable."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 font-sans">
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-6 py-6" aria-label="Approvals Hub">
          <div className="max-w-[1000px] mx-auto">
            <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-800 dark:text-slate-100 mb-1">
              <i className="fa-solid fa-stamp text-indigo-500" aria-hidden="true" />
              Approvals Hub
            </h1>
            <p className="text-[13px] text-slate-400 dark:text-slate-500 mb-6">
              Review and sign off on tasks assigned to you. You have {pendingApprovals.length} pending requests.
            </p>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">Pending Sign-off</div>
                <div className="text-2xl font-black text-amber-500">{pendingApprovals.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">Approved This Week</div>
                <div className="text-2xl font-black text-emerald-500">0</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">Decisions Made</div>
                <div className="text-2xl font-black text-slate-500">0</div>
              </div>
            </div>

            {/* Main Approvals Queue */}
            <div className="space-y-4">
              {pendingApprovals.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-950">
                  <div className="rounded-full bg-slate-50 p-4 mb-4 dark:bg-slate-900">
                    <i className="fa-solid fa-stamp text-slate-300 text-3xl" />
                  </div>
                  <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">Inbox cleared!</h3>
                  <p className="text-xs text-slate-400">You do not have any pending approval requests.</p>
                </div>
              ) : (
                pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex flex-col md:flex-row justify-between gap-6 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-[0_4px_20px_rgba(15,23,42,0.02)]"
                  >
                    <div className="flex-1 space-y-3">
                      <div>
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          Pending Review
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                          {approval.task?.title || "Untitled Task"}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Requested by {approval.requester?.name || "Workspace member"}
                        </p>
                      </div>
                      
                      {/* Optional Note Input */}
                      <div className="pt-2">
                        <textarea
                          placeholder="Add approval/rejection note (optional)..."
                          value={notes[approval.id] || ""}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [approval.id]: e.target.value }))
                          }
                          className="w-full min-h-[60px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col justify-end gap-2 md:w-[150px]">
                      <button
                        type="button"
                        onClick={() => handleResolve(approval.id, "APPROVED")}
                        disabled={resolveMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                      >
                        <i className="fa-solid fa-check" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolve(approval.id, "REJECTED")}
                        disabled={resolveMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition"
                      >
                        <i className="fa-solid fa-xmark" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
