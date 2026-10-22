import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';
import { lookupKeywordDefinition } from '../engine/keywordGlossary';

interface KeywordBadgeProps {
  keyword: string;
  variant?:
    | 'unit_keyword'
    | 'weapon_ability'
    | 'core_ability'
    | 'faction_ability'
    | 'stat_helper'
    | 'strength_calc';
  customDescription?: string;
  customLabel?: string;
  coachUnderline?: boolean;
}

interface TooltipPosition {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

export const KeywordBadge: React.FC<KeywordBadgeProps> = ({
  keyword,
  variant = 'unit_keyword',
  customDescription,
  customLabel,
  coachUnderline = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pinnedByClick, setPinnedByClick] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const hoverTimeoutRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const definition = lookupKeywordDefinition(keyword);

  // Compute position relative to viewport using getBoundingClientRect()
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(320, window.innerWidth - 32);
    const tooltipEstimatedHeight = 160;

    // Prefer displaying on top, unless too close to viewport top
    const placement: 'top' | 'bottom' =
      rect.top > tooltipEstimatedHeight + 16 ? 'top' : 'bottom';

    // Center horizontally on trigger, clamped to screen edges
    const centerX = rect.left + rect.width / 2;
    const clampedX = Math.max(
      16,
      Math.min(window.innerWidth - tooltipWidth - 16, centerX - tooltipWidth / 2)
    );

    const top =
      placement === 'top'
        ? rect.top - 8 // We'll translate Y by -100% in CSS
        : rect.bottom + 8;

    setPosition({
      top,
      left: clampedX,
      placement,
    });
  };

  // Recompute position on resize/scroll when open
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  // Handle outside click dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(target)
      ) {
        setIsOpen(false);
        setPinnedByClick(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = window.setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, 100);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (!pinnedByClick) {
      setIsOpen(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinnedByClick) {
      setPinnedByClick(false);
      setIsOpen(false);
    } else {
      updatePosition();
      setPinnedByClick(true);
      setIsOpen(true);
    }
  };

  const badgeClasses =
    variant === 'weapon_ability'
      ? 'text-[11px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-200/95 border border-amber-500/30 font-medium cursor-help transition inline-flex items-center gap-0.5'
      : variant === 'core_ability'
      ? 'text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-500/50 cursor-help transition inline-flex items-center gap-1'
      : variant === 'faction_ability'
      ? 'text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-help transition inline-flex items-center gap-1'
      : variant === 'stat_helper'
      ? `inline-flex items-center gap-0.5 cursor-help hover:text-amber-300 transition ${
          coachUnderline ? 'border-b border-dotted border-amber-400/60' : ''
        }`
      : variant === 'strength_calc'
      ? `inline-flex items-center justify-center px-1.5 py-0.5 rounded font-bold text-emerald-300 hover:bg-emerald-950/70 hover:text-emerald-200 cursor-help transition ${
          coachUnderline
            ? 'border border-dotted border-emerald-500/60 bg-emerald-950/30'
            : ''
        }`
      : 'px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-amber-200 cursor-help transition inline-flex items-center gap-0.5';

  const displayLabel =
    customLabel !== undefined
      ? customLabel
      : variant === 'weapon_ability'
      ? `[${keyword.replace(/^\[|\]$/g, '')}]`
      : keyword;

  const categoryLabel =
    variant === 'weapon_ability'
      ? 'Weapon Ability'
      : variant === 'core_ability'
      ? 'Core Ability'
      : variant === 'faction_ability'
      ? 'Faction Ability'
      : variant === 'stat_helper' || variant === 'strength_calc'
      ? 'Tabletop Coach Helper'
      : definition?.category === 'weapon'
      ? 'Weapon Rule'
      : definition?.category === 'core_rule'
      ? 'Core Rule'
      : 'Unit Keyword';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={badgeClasses}
        aria-expanded={isOpen}
      >
        <span>{displayLabel}</span>
      </button>

      {isOpen &&
        definition &&
        position &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) {
                window.clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
              }
            }}
            onMouseLeave={handleMouseLeave}
            style={{
              position: 'fixed',
              top: `${position.top}px`,
              left: `${position.left}px`,
              transform: position.placement === 'top' ? 'translateY(-100%)' : 'none',
              zIndex: 9999,
              width: `${Math.min(320, window.innerWidth - 32)}px`,
            }}
            className="p-3 rounded-xl bg-slate-950/95 backdrop-blur-md border border-amber-500/70 shadow-2xl shadow-black/95 text-left normal-case tracking-normal animate-in fade-in duration-100"
          >
            <div className="flex items-start justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wide">
                    {definition.name}
                  </span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  11th Ed · {categoryLabel}
                </span>
              </div>
              {pinnedByClick && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setPinnedByClick(false);
                  }}
                  className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                  aria-label="Close tooltip"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <p className="text-[11px] font-semibold text-white leading-snug mb-1.5">
              {definition.summary}
            </p>
            <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">
              {customDescription || definition.description}
            </p>
          </div>,
          document.body
        )}
    </>
  );
};
