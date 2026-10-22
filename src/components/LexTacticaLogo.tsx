import React from 'react';

interface LexTacticaLogoProps {
  className?: string;
  size?: number;
}

export const LexTacticaLogo: React.FC<LexTacticaLogoProps> = ({
  className = 'w-6 h-6',
  size = 24,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Lex Tactica Power Sword Logo"
    >
      <defs>
        {/* Luminous Blade Gradient */}
        <linearGradient id="swBladeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        {/* Golden Hilt & Crossguard Gradient */}
        <linearGradient id="swGoldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>

        {/* Gem Ruby/Topaz Glow */}
        <radialGradient id="swGemGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="60%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>

        {/* Ambient Power Glow Filter */}
        <filter id="swGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. Subtle Power Sparkles / Bling Glints around the Blade */}
      {/* Sparkle 1 (Upper Left blade tip glint) */}
      <path
        d="M 6.5 4.5 Q 6.5 7 4 7 Q 6.5 7 6.5 9.5 Q 6.5 7 9 7 Q 6.5 7 6.5 4.5 Z"
        fill="#fef08a"
        opacity="0.9"
      />
      <circle cx="6.5" cy="7" r="0.6" fill="#ffffff" />

      {/* Sparkle 2 (Mid Right blade edge) */}
      <path
        d="M 23 11 Q 23 12.8 21.2 12.8 Q 23 12.8 23 14.6 Q 23 12.8 24.8 12.8 Q 23 12.8 23 11 Z"
        fill="#fbbf24"
        opacity="0.85"
      />
      <circle cx="23" cy="12.8" r="0.5" fill="#ffffff" />

      {/* Sparkle 3 (Lower Left hilt accent) */}
      <circle cx="8" cy="18.5" r="0.75" fill="#fde047" opacity="0.7" />

      {/* 2. Angelic / Imperial Laurels (Subtle Golden Nick-Nack at the crossguard) */}
      <g fill="url(#swGoldGrad)" opacity="0.85">
        {/* Left Laurel Leaves */}
        <path d="M 12 18.5 C 9.5 17 8 19 10 20.5 C 11.2 19.8 11.8 19.2 12 18.5 Z" />
        <path d="M 10 21.2 C 8 20.2 7 22.2 9 23.2 C 9.8 22.4 10.2 21.8 10 21.2 Z" />
        {/* Right Laurel Leaves */}
        <path d="M 20 18.5 C 22.5 17 24 19 22 20.5 C 20.8 19.8 20.2 19.2 20 18.5 Z" />
        <path d="M 22 21.2 C 24 20.2 25 22.2 23 23.2 C 22.2 22.4 21.8 21.8 22 21.2 Z" />
      </g>

      {/* 3. The Power Sword Blade (Vertical, Pointing Up) */}
      <g filter="url(#swGlow)">
        {/* Left Blade Bevel (Lighter / Catching Light) */}
        <path
          d="M 16 1.8 L 13.8 6.5 L 14.2 18.5 L 16 18.5 Z"
          fill="url(#swBladeGrad)"
        />
        {/* Right Blade Bevel (Slightly deeper gold for 3D bevel look) */}
        <path
          d="M 16 1.8 L 18.2 6.5 L 17.8 18.5 L 16 18.5 Z"
          fill="#d97706"
        />
        {/* Central Fuller / Power Conduit Ridge (Bright white-gold core) */}
        <line
          x1="16"
          y1="5"
          x2="16"
          y2="17.5"
          stroke="#ffffff"
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.95"
        />
        {/* Lightning / Power Etching on Blade */}
        <path
          d="M 16 7 L 15 9.5 L 16.5 11 L 15.2 14"
          stroke="#ffffff"
          strokeWidth="0.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>

      {/* 4. Ornate Warhammer 40k Crossguard (Winged / Stepped Quillons) */}
      <path
        d="M 7.5 19 L 10.5 17.5 L 14.5 18.2 L 16 18.8 L 17.5 18.2 L 21.5 17.5 L 24.5 19 L 23.5 20.5 L 19 19.8 L 16 20.5 L 13 19.8 L 8.5 20.5 Z"
        fill="url(#swGoldGrad)"
        stroke="#78350f"
        strokeWidth="0.5"
      />
      {/* Quillon End Finials (Golden Orbs) */}
      <circle cx="7.5" cy="19" r="1.2" fill="#fde047" stroke="#78350f" strokeWidth="0.4" />
      <circle cx="24.5" cy="19" r="1.2" fill="#fde047" stroke="#78350f" strokeWidth="0.4" />

      {/* 5. Center Jeweled Core (Embedded Ruby / Topaz Power Generator) */}
      <circle cx="16" cy="19.4" r="1.8" fill="url(#swGemGlow)" stroke="#fef08a" strokeWidth="0.5" />
      <circle cx="15.5" cy="18.9" r="0.5" fill="#ffffff" />

      {/* 6. Grip / Handle (Wrapped Leather / Gold Wire Ribs) */}
      <path
        d="M 14.8 20.5 L 14.8 27 L 17.2 27 L 17.2 20.5 Z"
        fill="#78350f"
      />
      {/* Handle Ribs */}
      <line x1="14.8" y1="22" x2="17.2" y2="22" stroke="#f59e0b" strokeWidth="0.6" />
      <line x1="14.8" y1="23.8" x2="17.2" y2="23.8" stroke="#f59e0b" strokeWidth="0.6" />
      <line x1="14.8" y1="25.6" x2="17.2" y2="25.6" stroke="#f59e0b" strokeWidth="0.6" />

      {/* 7. Pommel (Faceted Skull-Crown or Diamond Jewel) */}
      <polygon
        points="16,27.2 18,29 16,30.8 14,29"
        fill="url(#swGoldGrad)"
        stroke="#78350f"
        strokeWidth="0.5"
      />
      <circle cx="16" cy="29" r="0.6" fill="#fef08a" />
    </svg>
  );
};
