import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Map as MapIcon, Key } from 'lucide-react';
import type { MapLayoutDescriptor } from '../types/rules';
import { getLayoutImageUrl, getTerrainKeyImageUrl } from '../engine/missionEngine';

interface MapLightboxModalProps {
  layout: MapLayoutDescriptor;
  onClose: () => void;
}

export const MapLightboxModal: React.FC<MapLightboxModalProps> = ({ layout, onClose }) => {
  const [showTerrainKey, setShowTerrainKey] = useState(false);
  const [zoom, setZoom] = useState(1);

  const currentImageSrc = showTerrainKey
    ? getTerrainKeyImageUrl()
    : getLayoutImageUrl(layout.file);

  const zoomIn = () => setZoom((prev) => Math.min(prev + 0.3, 2.5));
  const zoomOut = () => setZoom((prev) => Math.max(prev - 0.3, 0.7));
  const resetZoom = () => setZoom(1);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-2 sm:p-4 no-print select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 px-2 text-white">
        <div className="flex items-center gap-3">
          <MapIcon className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-wide">
              {showTerrainKey ? 'Terrain Key & Height Guide' : `Layout ${layout.layout} · Page ${layout.page}`}
            </h2>
            <p className="text-xs text-slate-400 hidden sm:block">
              Attacker: <span className="text-rose-400">{layout.attacker.disposition}</span> ({layout.attacker.mission}) ·
              Defender: <span className="text-blue-400">{layout.defender.disposition}</span> ({layout.defender.mission})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Key toggle */}
          <button
            type="button"
            onClick={() => setShowTerrainKey((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              showTerrainKey
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            {showTerrainKey ? 'Show Layout Map' : 'Terrain Key'}
          </button>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-0.5">
            <button
              type="button"
              onClick={zoomOut}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
        <img
          src={currentImageSrc}
          alt={showTerrainKey ? 'Terrain Key' : `Map Layout ${layout.layout}`}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          className="max-h-[82vh] max-w-full object-contain transition-transform duration-150 rounded shadow-2xl"
        />
      </div>

      {/* Footer */}
      <div className="pt-2 text-center text-xs text-slate-500">
        WH40k 11th Edition Tournament Companion · Layout {layout.layout} (Page {layout.page})
      </div>
    </div>
  );
};
