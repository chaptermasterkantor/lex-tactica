import React, { useEffect, useState } from 'react';
import { BookOpen, X, Search } from 'lucide-react';
import type { CoreAction, Phase } from '../types/rules';

interface CoreActionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  coreActions: CoreAction[];
  currentPhase: Phase;
  initialSearch?: string;
}

export const CoreActionsDrawer: React.FC<CoreActionsDrawerProps> = ({
  isOpen,
  onClose,
  coreActions,
  currentPhase,
  initialSearch = '',
}) => {
  const [filterPhaseOnly, setFilterPhaseOnly] = useState(true);
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    if (isOpen) {
      setSearch(initialSearch);
      const hasPhaseMatches = coreActions.some((a) => a.phases.includes(currentPhase));
      setFilterPhaseOnly(hasPhaseMatches && !initialSearch);
    }
  }, [isOpen, initialSearch, currentPhase, coreActions]);

  if (!isOpen) return null;

  const filtered = coreActions.filter((action) => {
    if (filterPhaseOnly && currentPhase !== 'any') {
      const matchesPhase =
        action.phases.includes(currentPhase) ||
        (currentPhase === 'charge' && /charge|surge|pile-in/i.test(action.name)) ||
        (currentPhase === 'pre_game' && /scout/i.test(action.name));
      if (!matchesPhase) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        action.name.toLowerCase().includes(q) || action.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm no-print">
      <div className="w-full max-w-xl bg-slate-950 border-l border-slate-800 h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white">
                11th Edition Universal Core Actions ({filtered.length})
              </h2>
              <p className="text-xs text-slate-400">
                Dedicated Move, Shoot, and Fight actions separated from Stratagems.csv
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center gap-3 bg-slate-900/30">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Surge Move, Snap Shooting, Fall-Back, Overrun..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterPhaseOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              filterPhaseOnly
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            {filterPhaseOnly ? 'Showing Current Phase Only' : 'Showing All Phases'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.map((action) => (
            <div
              key={action.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-amber-300 tracking-wide">{action.name}</h3>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {action.rawPhase}
                </span>
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                {action.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
