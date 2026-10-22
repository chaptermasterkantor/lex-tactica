import React, { useState } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { getAllSecondaryCards } from '../engine/missionEngine';
import type { SecondaryCard } from '../types/rules';

interface FixedSecondariesModalProps {
  initialSelectedCards: string[];
  sideLabel: string;
  onConfirm: (selectedCards: string[]) => void;
  onClose: () => void;
}

export const FixedSecondariesModal: React.FC<FixedSecondariesModalProps> = ({
  initialSelectedCards,
  sideLabel,
  onConfirm,
  onClose,
}) => {
  const [selected, setSelected] = useState<string[]>(initialSelectedCards);
  const allCards: SecondaryCard[] = getAllSecondaryCards();

  const toggleCard = (card: SecondaryCard) => {
    if (card.type !== 'Fixed / Tactical') return;
    if (selected.includes(card.name)) {
      setSelected(selected.filter((n) => n !== card.name));
    } else {
      if (selected.length >= 2) return;
      setSelected([...selected, card.name]);
    }
  };

  const isValid = selected.length === 2;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 no-print">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-slate-950/70">
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide uppercase">
              Fixed Secondaries — {sideLabel}
            </h2>
            <p className="text-xs text-amber-400 font-medium">
              Pick exactly 2 Fixed secondaries ({selected.length} of 2 chosen) — they stay active every round of the game and score their FIXED tier.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allCards.map((card) => {
            const isFixedEligible = card.type === 'Fixed / Tactical';
            const isChosen = selected.includes(card.name);
            const fixedScoreGroup = card.score.find((s) => s.mode === 'Fixed');

            return (
              <div
                key={card.name}
                onClick={() => isFixedEligible && toggleCard(card)}
                className={`border rounded-xl p-3 flex flex-col justify-between transition relative ${
                  !isFixedEligible
                    ? 'border-slate-800/80 bg-slate-950/40 opacity-40 cursor-not-allowed'
                    : isChosen
                    ? 'border-amber-500 bg-amber-500/10 cursor-pointer shadow-lg shadow-amber-500/10 ring-1 ring-amber-500'
                    : 'border-slate-800 bg-slate-950/80 hover:border-slate-700 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-white">{card.name}</span>
                    {isFixedEligible ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-500/50 text-amber-300 bg-amber-500/20 whitespace-nowrap">
                        FIXED / TACTICAL
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-rose-900/60 text-rose-400/80 bg-rose-950/20 whitespace-nowrap">
                        NO FIXED TIER
                      </span>
                    )}
                  </div>

                  {fixedScoreGroup && (
                    <div className="text-xs text-slate-300 mt-2 space-y-1">
                      <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                        {fixedScoreGroup.when}:
                      </div>
                      {fixedScoreGroup.items.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="font-bold text-amber-400 text-xs">+{item.vp} VP:</span>
                          <span className="text-slate-300 text-[11px] leading-tight">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {isChosen && (
                  <div className="mt-3 pt-2 border-t border-amber-500/30 flex items-center justify-between text-xs text-amber-300 font-bold">
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Selected
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-5 py-3 bg-slate-950/70 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {isValid ? (
              <span className="text-emerald-400 font-medium">Ready: 2 secondaries selected.</span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Please select exactly 2 fixed cards.
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={!isValid}
            onClick={() => onConfirm(selected)}
            className="px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 transition shadow"
          >
            Confirm Secondaries
          </button>
        </div>
      </div>
    </div>
  );
};
