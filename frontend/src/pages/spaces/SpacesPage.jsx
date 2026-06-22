import { useEffect } from "react";
import { useOutletContext } from "react-router";
import { useAppContext } from "../AppContext";

export default function SpacesPage() {
  const { setPath } = useOutletContext() || {};
  const {
    spaces,
    activeSpaceId,
    activeBoards,
    activeSpace,
    setActiveSpace,
    setActiveBoard,
  } = useAppContext();

  useEffect(() => {
    setPath?.([
      { name: "Workspace", color: "text-slate-400", ref: "/dashboard" },
      { name: "Spaces", color: "text-slate-800", ref: "" },
    ]);
  }, [setPath]);

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-5">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Workspace Directory</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">Spaces</h1>
          <p className="mt-2 text-sm text-slate-500">
            Live spaces, departments, and boards loaded from the backend.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">All spaces</div>
            <div className="space-y-3">
              {spaces.map((space) => {
                const selected = space.id === activeSpaceId;
                return (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => setActiveSpace(space.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-sky-400 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{space.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{space.description || "No description available."}</div>
                    <div className="mt-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Prefix: {space.prefix || "N/A"}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Active space</div>
            {activeSpace ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-lg font-black text-slate-950">{activeSpace.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{activeSpace.description || "No description provided."}</div>
                </div>

                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-700">Boards</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeBoards.map((board) => (
                      <button
                        key={board.id}
                        type="button"
                        onClick={() => setActiveBoard(board.id)}
                        className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50"
                      >
                        <div className="text-sm font-semibold text-slate-900">{board.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{board.description || "No description provided."}</div>
                      </button>
                    ))}
                    {!activeBoards.length && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                        No boards returned for this space yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No spaces are available for the current user.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
