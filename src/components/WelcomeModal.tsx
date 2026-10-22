import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Upload,
  SlidersHorizontal,
  FolderOpen,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GraduationCap,
} from 'lucide-react';
import { LexTacticaLogo } from './LexTacticaLogo';

export interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImport: () => void;
  onOpenSetup: () => void;
  onOpenRosters: () => void;
  onSelectCoachPreference?: (enabled: boolean) => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onOpenImport,
  onOpenSetup,
  onOpenRosters,
  onSelectCoachPreference,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [showFourSteps, setShowFourSteps] = useState(false);

  if (!isOpen) return null;

  const markWelcomeSeen = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem('lex_tactica_welcome_seen', 'true');
      } catch {
        // ignore localStorage errors in private browsing
      }
    }
  };

  const handleCloseWithDemo = (enableCoach: boolean) => {
    markWelcomeSeen();
    if (onSelectCoachPreference) {
      onSelectCoachPreference(enableCoach);
    }
    onClose();
  };

  const handleAction = (callback: () => void, enableCoach: boolean) => {
    try {
      localStorage.setItem('lex_tactica_welcome_seen', 'true');
    } catch {
      // ignore
    }
    if (onSelectCoachPreference) {
      onSelectCoachPreference(enableCoach);
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
            onClick={() => handleCloseWithDemo(true)}
            className="absolute top-4 right-4 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
                Your local-first tactical tabletop cockpit for Warhammer 40,000 11th Edition
              </p>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Action-First Launchpad (Top Priority) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Choose How To Start:
              </span>
              <span className="text-[11px] text-slate-400">
                100% Offline · Saved on this device
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Import List (Defaults Coach OFF for fast veteran entry) */}
              <button
                type="button"
                onClick={() => handleAction(onOpenImport, false)}
                className="group p-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 hover:border-amber-400 text-left transition flex flex-col justify-between shadow-lg shadow-amber-950/20"
              >
                <div className="flex items-center justify-between">
                  <Upload className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 uppercase">
                    Fast Play
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                    Import Army List
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Paste New Recruit JSON, .rosz, or text export (Coach Off by default)
                  </div>
                </div>
              </button>

              {/* Option 2: Explore with Demo Army + Guided Coach ON */}
              <button
                type="button"
                onClick={() => handleCloseWithDemo(true)}
                className="group p-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/50 hover:border-emerald-400 text-left transition flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <GraduationCap className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-400 text-slate-950 uppercase">
                    Guided Coach
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-bold text-white group-hover:text-emerald-300 transition">
                    Explore Demo Army
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Space Marines Crimson Fists with step-by-step phase prompts &amp; roll helpers
                  </div>
                </div>
              </button>

              {/* Option 3: Build Formation / Saved Lists */}
              <button
                type="button"
                onClick={() => handleAction(onOpenSetup, true)}
                className="group p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-left transition flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <SlidersHorizontal className="w-5 h-5 text-teal-400 group-hover:scale-110 transition-transform" />
                  <FolderOpen className="w-4 h-4 text-slate-400" />
                </div>
                <div className="mt-3">
                  <div className="text-sm font-bold text-white group-hover:text-teal-300 transition">
                    Build / Saved Rosters
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Customize units, attach Support Leaders &amp; switch lists
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Value Proposition Summary */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>One Cockpit for Your 1st Game or Your 100th</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong>Lex Tactica cuts through rulebook paralysis</strong> by filtering out irrelevant rules and surfacing only the actions, weapons, and Stratagems valid in the{' '}
              <strong>exact turn and phase you are playing</strong>. Toggle{' '}
              <span className="text-amber-300 font-semibold">🎓 Coach: ON / OFF</span> in the top bar anytime to show or hide beginner phase prompts and wound-roll charts.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero login — saved to device</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Bottom thumb-bar for 1-handed play</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Interactive S vs T Wound Chart</span>
              </div>
            </div>
          </div>

          {/* Collapsible 4-Step Battle Flow Walkthrough */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFourSteps((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-300 hover:text-white transition"
            >
              <span>How a 40k 11th Edition Battle Works in 4 Steps</span>
              {showFourSteps ? (
                <ChevronUp className="w-4 h-4 text-amber-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-amber-400" />
              )}
            </button>

            {showFourSteps && (
              <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-800/80">
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                  <div className="text-xs font-bold text-amber-300">1. Roster &amp; Board Setup</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Import your list or pick a saved army, then launch the 5-step Match Setup Wizard to pick Force Dispositions, generate your asymmetric Primary Mission, and view your official terrain map.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                  <div className="text-xs font-bold text-teal-300">2. Pre-Game Formation</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Attach up to 1 Regular Leader + 1 Support Leader to bodyguard squads, assign Deep Strike units to Reserves, and resolve Infiltrators &amp; Scouts.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                  <div className="text-xs font-bold text-emerald-300">3. Proactive &amp; Reactive Cockpit</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Step through phases using the bottom Thumb-Bar. Green is Your Turn; Red is your Opponent&apos;s Turn (surfacing Overwatch, saves, and Opponent Watchlist Stratagems).
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5">
                  <div className="text-xs font-bold text-indigo-300">4. Score &amp; Complete Match</div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Mark units Moved/Shot/Charged/Fought, draw &amp; score Tactical Secondaries, and save your final Victory Summary to your device&apos;s Match History.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Quick Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleAction(onOpenRosters, false)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
            >
              <span>View Saved Rosters &amp; Match History</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>

            <label className="inline-flex items-center gap-2 text-xs text-slate-400 select-none cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
              />
              <span>Don&apos;t show again automatically</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
