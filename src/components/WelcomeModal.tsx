import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Upload,
  SlidersHorizontal,
  FolderOpen,
  Sword,
  Play,
  CheckCircle2,
  HelpCircle,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { LexTacticaLogo } from './LexTacticaLogo';

export interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImport: () => void;
  onOpenSetup: () => void;
  onOpenRosters: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onOpenImport,
  onOpenSetup,
  onOpenRosters,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('lex_tactica_welcome_seen', 'true');
      } catch {
        // ignore localStorage errors in private browsing
      }
    }
    onClose();
  };

  const handleAction = (callback: () => void) => {
    try {
      localStorage.setItem('lex_tactica_welcome_seen', 'true');
    } catch {
      // ignore
    }
    onClose();
    callback();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 no-print overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-3xl max-h-[92vh] bg-[#0d1017] border border-amber-500/40 rounded-2xl flex flex-col shadow-2xl shadow-amber-950/20 overflow-hidden my-auto">
        {/* Header Banner */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-800 bg-gradient-to-r from-amber-950/30 via-slate-900/50 to-slate-900/80">
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <LexTacticaLogo className="w-8 h-8 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-wider text-amber-400 uppercase">
                  Lex Tactica
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  WH40K 11TH ED PLAYBOOK
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Your tactical tabletop cockpit for Warhammer 40,000 11th Edition
              </p>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Mission & Value Proposition */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Designed for Fast, Stress-Free Tabletop Play</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Whether it’s your 1st game or 100th, Warhammer 40k involves dozens of rules, stratagems, and abilities across multiple books.
              <strong> Lex Tactica cuts through the clutter</strong> by only displaying the rules, stratagems, and actions that are valid in the
              <strong> exact turn and phase you are currently playing</strong>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero login — saved to device</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>100% Offline PWA ready</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Live Wahapedia 11th Ed rules</span>
              </div>
            </div>
          </div>

          {/* 4-Step Battle Flow Walkthrough */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              How A Battle Works in 4 Simple Steps
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center border border-amber-500/40">
                    1
                  </span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Get Your Roster Ready
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Export your army from <strong>New Recruit</strong>, <strong>Battlescribe</strong>, or text and paste it in.
                  The app automatically validates 11th Ed Detachment Points (DP) and model costs.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-500/40">
                    2
                  </span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Pre-Game Formation & Setup
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Attach your <strong>Regular Leader</strong> + <strong>Support Leader</strong> to bodyguard squads, determine 1st turn,
                  and follow the pre-game checklist for Scouts and Infiltrator moves.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-500/40">
                    3
                  </span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Phase-by-Phase Cockpit
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Advance through the 5 battle rounds. The top cockpit turns <strong>Green</strong> on your turn and <strong>Red</strong> on
                  your opponent’s turn. Your active Faction Rules and Detachments appear automatically.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/40">
                    4
                  </span>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Track Tabletop Activations
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Units start cleanly collapsed. Tap any unit to view weapons, tap <strong>&quot;Mark Moved / Shot / Charged / Fought&quot;</strong> to track who has acted,
                  and pop out phase Stratagems with 1 tap.
                </p>
              </div>
            </div>
          </div>

          {/* Action Launchers Matrix */}
          <div className="pt-2 border-t border-slate-800/90 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
              Choose How To Start:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Import List */}
              <button
                type="button"
                onClick={() => handleAction(onOpenImport)}
                className="group p-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 hover:border-amber-400 text-left transition flex flex-col justify-between shadow-lg shadow-amber-950/20"
              >
                <div className="flex items-center justify-between">
                  <Upload className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 uppercase">
                    Recommended
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                    Import List
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Paste New Recruit, .rosz, or text export
                  </div>
                </div>
              </button>

              {/* Option 2: Build / Edit Formation */}
              <button
                type="button"
                onClick={() => handleAction(onOpenSetup)}
                className="group p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-left transition flex flex-col justify-between"
              >
                <SlidersHorizontal className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform" />
                <div className="mt-3">
                  <div className="text-sm font-bold text-white group-hover:text-teal-300 transition">
                    Build Formation
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Customize units, leaders & detachments
                  </div>
                </div>
              </button>

              {/* Option 3: Saved Device Lists */}
              <button
                type="button"
                onClick={() => handleAction(onOpenRosters)}
                className="group p-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-left transition flex flex-col justify-between"
              >
                <FolderOpen className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                <div className="mt-3">
                  <div className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
                    Saved Rosters
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    View or switch between saved lists
                  </div>
                </div>
              </button>
            </div>

            {/* Quick Demo Option */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Explore with Demo Army (Space Marines Crimson Fists)</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              </button>

              <label className="inline-flex items-center gap-2 text-xs text-slate-400 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                />
                <span>Don&apos;t show again automatically</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
