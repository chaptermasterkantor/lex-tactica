import React, { useEffect, useState } from 'react';
import {
  X,
  Upload,
  FileText,
  Plus,
  Trash2,
  AlertTriangle,
  Download,
  Users,
  ShieldCheck,
} from 'lucide-react';
import editionRules from '../config/editionRules.json';
import type {
  BattleSize,
  Datasheet,
  Detachment,
  Enhancement,
  Faction,
  RosterUnit,
  SavedRoster,
  UnitBattlefieldStatus,
} from '../types/rules';
import {
  getExpectedPointsForUnitCopy,
  resolveCharacterAttachmentCapabilities,
  validateRoster,
} from '../engine/rosterValidator';
import {
  importFromNewRecruitJson,
  importFromPlainTextList,
  importFromRoszOrRosFile,
} from '../importers/rosterImporter';
import {
  KNOWN_SPACE_MARINE_CHAPTERS,
  isDarkAngelsRoster,
} from '../engine/chapterKeywordRules';

interface RosterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'setup' | 'import' | 'rosters';
  roster: SavedRoster;
  allRosters: SavedRoster[];
  factions: Faction[];
  datasheets: Datasheet[];
  detachments: Detachment[];
  enhancements: Enhancement[];
  onSaveRoster: (updated: SavedRoster) => Promise<void>;
  onSelectRoster: (rosterId: string) => Promise<void>;
  onDeleteRoster: (rosterId: string) => Promise<void>;
  onChangeFaction: (factionId: string) => Promise<void>;
}

export const RosterEditorModal: React.FC<RosterEditorModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'setup',
  roster,
  allRosters,
  factions,
  datasheets,
  detachments,
  enhancements,
  onSaveRoster,
  onSelectRoster,
  onDeleteRoster,
  onChangeFaction,
}) => {
  const [activeTab, setActiveTab] = useState<'setup' | 'import' | 'rosters'>(initialTab);
  const [importFactionId, setImportFactionId] = useState(roster.factionId);
  const [pasteText, setPasteText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [addUnitDatasheetId, setAddUnitDatasheetId] = useState('');
  const [expandedWeaponsUnitId, setExpandedWeaponsUnitId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const datasheetsById = new Map(datasheets.map((d) => [d.id, d]));
  const detachmentsById = new Map(detachments.map((d) => [d.id, d]));
  const enhancementsById = new Map(enhancements.map((e) => [e.id, e]));

  const validationIssues = validateRoster(
    roster,
    datasheetsById,
    detachmentsById,
    enhancementsById
  );

  const isDaArmy = isDarkAngelsRoster(roster, datasheetsById);

  const battleSizeConfig =
    editionRules.battleSizes[roster.battleSize] ?? editionRules.battleSizes.strike_force;

  const recalculateTotals = (nextRoster: SavedRoster): SavedRoster => {
    const unitPts = nextRoster.units.reduce((sum, u) => sum + u.points, 0);
    const detDp = nextRoster.detachmentIds.reduce((sum, id) => {
      const d = detachmentsById.get(id);
      return sum + (d?.dp ?? 1);
    }, 0);
    const primaryDet = detachmentsById.get(nextRoster.detachmentIds[0]);
    return {
      ...nextRoster,
      totalPoints: unitPts,
      totalDetachmentPoints: detDp,
      forceDisposition: primaryDet?.forceDisposition ?? nextRoster.forceDisposition,
      updatedAt: Date.now(),
    };
  };

  // Identify characters that can attach as Regular Leaders or Support Leaders
  const regularLeaderUnits = roster.units.filter((u) => {
    const ds = datasheetsById.get(u.datasheetId);
    if (!ds) return false;
    const enhs = u.enhancementIds
      .map((id) => enhancementsById.get(id))
      .filter((e): e is Enhancement => Boolean(e));
    const caps = resolveCharacterAttachmentCapabilities(ds, enhs);
    return (caps.canAttach || /character|epic hero/i.test(ds.role)) && caps.slotType === 'leader';
  });

  const supportLeaderUnits = roster.units.filter((u) => {
    const ds = datasheetsById.get(u.datasheetId);
    if (!ds) return false;
    const enhs = u.enhancementIds
      .map((id) => enhancementsById.get(id))
      .filter((e): e is Enhancement => Boolean(e));
    const caps = resolveCharacterAttachmentCapabilities(ds, enhs);
    return (caps.canAttach || ds.isSupport) && caps.slotType === 'support';
  });

  const toggleDetachment = (detId: string) => {
    const exists = roster.detachmentIds.includes(detId);
    const nextIds = exists
      ? roster.detachmentIds.filter((id) => id !== detId)
      : [...roster.detachmentIds, detId];
    onSaveRoster(recalculateTotals({ ...roster, detachmentIds: nextIds }));
  };

  const handleAddUnit = () => {
    const ds = datasheetsById.get(addUnitDatasheetId);
    if (!ds) return;
    const existingCopies = roster.units.filter((u) => u.datasheetId === ds.id).length;
    const defaultModels = ds.costTiers[0]?.modelsCount ?? 1;
    const expectedPts = getExpectedPointsForUnitCopy(ds, defaultModels, existingCopies + 1);

    const newUnit: RosterUnit = {
      instanceId: `unit_${Date.now()}_${roster.units.length + 1}`,
      datasheetId: ds.id,
      startingModels: defaultModels,
      startingWoundsPerModel: ds.models[0]?.W ?? 1,
      points: expectedPts,
      equippedWeaponIds: [...ds.rangedWeapons, ...ds.meleeWeapons].map((w) => w.id),
      enhancementIds: [],
      initialStatus: 'on_battlefield',
    };
    onSaveRoster(recalculateTotals({ ...roster, units: [...roster.units, newUnit] }));
  };

  const handleUpdateUnit = (instanceId: string, updater: (u: RosterUnit) => RosterUnit) => {
    const nextUnits = roster.units.map((u) => (u.instanceId === instanceId ? updater(u) : u));
    onSaveRoster(recalculateTotals({ ...roster, units: nextUnits }));
  };

  const handleRemoveUnit = (instanceId: string) => {
    const nextUnits = roster.units
      .filter((u) => u.instanceId !== instanceId)
      .map((u) => ({
        ...u,
        attachedLeaderInstanceId:
          u.attachedLeaderInstanceId === instanceId ? undefined : u.attachedLeaderInstanceId,
        attachedSupportInstanceId:
          u.attachedSupportInstanceId === instanceId ? undefined : u.attachedSupportInstanceId,
      }));
    onSaveRoster(recalculateTotals({ ...roster, units: nextUnits }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      await onChangeFaction(importFactionId);
      const imported = await importFromRoszOrRosFile(
        file,
        importFactionId,
        datasheets,
        detachments,
        enhancements
      );
      await onSaveRoster(imported);
      setActiveTab('setup');
    } catch (err: any) {
      setImportError(err?.message || 'Failed to parse file.');
    }
  };

  const handlePasteImport = async () => {
    if (!pasteText.trim()) return;
    setImportError(null);
    try {
      await onChangeFaction(importFactionId);
      const trimmed = pasteText.trim();
      const imported = trimmed.startsWith('{')
        ? importFromNewRecruitJson(trimmed, importFactionId, datasheets, detachments, enhancements)
        : importFromPlainTextList(trimmed, importFactionId, datasheets, detachments, enhancements);
      await onSaveRoster(imported);
      setPasteText('');
      setActiveTab('setup');
    } catch (err: any) {
      setImportError(err?.message || 'Could not import pasted army list.');
    }
  };

  const handleExportJsonBackup = () => {
    const blob = new Blob([JSON.stringify(roster, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${roster.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-11ed.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Available enhancements for current detachments
  const rosterDetSet = new Set(roster.detachmentIds);
  const availableEnhancements = enhancements.filter(
    (e) => rosterDetSet.size === 0 || rosterDetSet.has(e.detachmentId)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 no-print">
      <div className="w-full max-w-5xl max-h-[90vh] bg-slate-950 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div>
            <h2 className="text-lg font-bold text-white">
              Roster & Pre-Game Battle Formations ({roster.name})
            </h2>
            <p className="text-xs text-slate-400">
              No account needed — rosters are saved on this device via IndexedDB
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJsonBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup JSON</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 px-6 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'setup'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Pre-Game Setup, Leaders & Units ({roster.units.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'import'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Import List (New Recruit .json / .rosz / Text Paste)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rosters')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === 'rosters'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Saved Device Rosters ({allRosters.length})
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'setup' && (
            <>
              {/* Validation Banner */}
              {validationIssues.length > 0 ? (
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-600/60 space-y-1">
                  {validationIssues.map((issue, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{issue.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-700/40 text-xs text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    11th Edition Roster Valid: {roster.totalPoints}/{battleSizeConfig.maxPoints} pts ·{' '}
                    {roster.totalDetachmentPoints}/{battleSizeConfig.maxDetachmentPoints} Detachment
                    Points (DP) · Max 1 Leader + 1 Support per unit verified.
                  </span>
                </div>
              )}

              {/* Roster Identity & Battle Size */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/70 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[11px] uppercase text-slate-400 font-semibold mb-1">
                    Roster Name
                  </label>
                  <input
                    type="text"
                    value={roster.name}
                    onChange={(e) => onSaveRoster({ ...roster, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] uppercase text-slate-400 font-semibold">
                      Sub-Faction / Chapter
                    </label>
                    {roster.factionId === 'SM' && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          isDaArmy
                            ? 'bg-emerald-950/70 border border-emerald-600/50 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isDaArmy
                          ? 'Dark Angels (Deathwing & Ravenwing active)'
                          : 'Codex Standard (Deathwing & Ravenwing suppressed)'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    list={roster.factionId === 'SM' ? 'sm-chapters-list' : undefined}
                    value={roster.subFactionName || ''}
                    placeholder={
                      roster.factionId === 'SM'
                        ? 'e.g. Ultramarines, Dark Angels, etc.'
                        : 'e.g. Sub-faction name'
                    }
                    onChange={(e) => onSaveRoster({ ...roster, subFactionName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                  {roster.factionId === 'SM' && (
                    <datalist id="sm-chapters-list">
                      {KNOWN_SPACE_MARINE_CHAPTERS.map((ch) => (
                        <option key={ch} value={ch} />
                      ))}
                    </datalist>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] uppercase text-slate-400 font-semibold mb-1">
                    Faction (25 Available)
                  </label>
                  <select
                    value={roster.factionId}
                    onChange={async (e) => {
                      const nextFaction = e.target.value;
                      await onChangeFaction(nextFaction);
                      await onSaveRoster({
                        ...roster,
                        factionId: nextFaction,
                        detachmentIds: [],
                        units: [],
                        totalPoints: 0,
                        totalDetachmentPoints: 0,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  >
                    {factions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase text-slate-400 font-semibold mb-1">
                    11th Ed Battle Size & DP Budget
                  </label>
                  <select
                    value={roster.battleSize}
                    onChange={(e) =>
                      onSaveRoster(
                        recalculateTotals({
                          ...roster,
                          battleSize: e.target.value as BattleSize,
                        })
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  >
                    <option value="incursion">Incursion (1,000 pts / 2 DP)</option>
                    <option value="strike_force">Strike Force (2,000 pts / 3 DP)</option>
                    <option value="onslaught">Onslaught (3,000 pts / 4 DP)</option>
                  </select>
                </div>
              </div>

              {/* Modular Detachments Picker */}
              <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    11th Ed Modular Detachments ({roster.totalDetachmentPoints} /{' '}
                    {battleSizeConfig.maxDetachmentPoints} DP Selected)
                  </span>
                  <span className="text-xs text-slate-400">
                    First selected detachment sets primary Force Disposition
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                  {detachments.map((det) => {
                    const isSelected = roster.detachmentIds.includes(det.id);
                    const isPrimary = roster.detachmentIds[0] === det.id;
                    return (
                      <button
                        key={det.id}
                        type="button"
                        onClick={() => toggleDetachment(det.id)}
                        className={`text-left p-2.5 rounded-lg border transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold truncate">{det.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 shrink-0">
                            {det.dp} DP
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                          <span>{det.forceDisposition || 'Matched Play'}</span>
                          {isPrimary && (
                            <span className="text-amber-300 font-semibold">★ Primary</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Unit Bar */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-900/70 p-3 rounded-xl border border-slate-800">
                <select
                  value={addUnitDatasheetId}
                  onChange={(e) => setAddUnitDatasheetId(e.target.value)}
                  className="flex-1 min-w-[220px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                >
                  <option value="">+ Select a Datasheet to add to Roster...</option>
                  {datasheets.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name} ({ds.role}{ds.isSupport ? ' · Support Character' : ''}) —{' '}
                      {ds.costTiers[0]?.cost ?? 0} pts
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!addUnitDatasheetId}
                  onClick={handleAddUnit}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Unit</span>
                </button>
              </div>

              {/* Roster Units List with 1 Leader + 1 Support Attachment Selectors */}
              <div className="space-y-3">
                {roster.units.map((unit) => {
                  const ds = datasheetsById.get(unit.datasheetId);
                  if (!ds) return null;
                  const isCharacter = /character|epic hero/i.test(ds.role) || ds.isSupport;
                  const allUnitWeapons = [...ds.rangedWeapons, ...ds.meleeWeapons];
                  const isWeaponsOpen = expandedWeaponsUnitId === unit.instanceId;

                  return (
                    <div
                      key={unit.instanceId}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-white">{ds.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {ds.role}
                            {ds.isSupport ? ' (11th Ed Support Slot)' : ''}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-xs text-slate-400 flex items-center gap-1">
                            <span>Models:</span>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={unit.startingModels}
                              onChange={(e) =>
                                handleUpdateUnit(unit.instanceId, (u) => ({
                                  ...u,
                                  startingModels: Math.max(1, parseInt(e.target.value, 10) || 1),
                                }))
                              }
                              className="w-14 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-white text-center"
                            />
                          </label>

                          <label className="text-xs text-slate-400 flex items-center gap-1">
                            <span>Pts:</span>
                            <input
                              type="number"
                              min={0}
                              value={unit.points}
                              onChange={(e) =>
                                handleUpdateUnit(unit.instanceId, (u) => ({
                                  ...u,
                                  points: Math.max(0, parseInt(e.target.value, 10) || 0),
                                }))
                              }
                              className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-amber-300 font-bold text-center"
                            />
                          </label>

                          <select
                            value={unit.initialStatus ?? 'on_battlefield'}
                            onChange={(e) =>
                              handleUpdateUnit(unit.instanceId, (u) => ({
                                ...u,
                                initialStatus: e.target.value as UnitBattlefieldStatus,
                              }))
                            }
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                          >
                            <option value="on_battlefield">Deploy: Battlefield</option>
                            <option value="reserves">Deploy: Reserves</option>
                            <option value="embarked">Deploy: Embarked</option>
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedWeaponsUnitId(isWeaponsOpen ? null : unit.instanceId)
                            }
                            className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                          >
                            Weapons ({unit.equippedWeaponIds?.length ?? allUnitWeapons.length}/
                            {allUnitWeapons.length})
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveUnit(unit.instanceId)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                            title="Remove Unit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* 1 Leader + 1 Support Attachment Slots (for Bodyguard units) */}
                      {!isCharacter && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-800/70">
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-amber-300 font-semibold mb-1">
                              <Users className="w-3 h-3 inline mr-1" />
                              Slot 1: Attached Regular Leader
                            </label>
                            <select
                              value={unit.attachedLeaderInstanceId || ''}
                              onChange={(e) =>
                                handleUpdateUnit(unit.instanceId, (u) => ({
                                  ...u,
                                  attachedLeaderInstanceId: e.target.value || undefined,
                                }))
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                            >
                              <option value="">— No Regular Leader Attached —</option>
                              {regularLeaderUnits.map((lu) => {
                                const lds = datasheetsById.get(lu.datasheetId);
                                if (!lds) return null;
                                const isOfficialTarget = lds.canLeadDatasheetIds.includes(ds.id);
                                return (
                                  <option key={lu.instanceId} value={lu.instanceId}>
                                    {lds.name}{' '}
                                    {isOfficialTarget ? '✓ (Valid Target)' : '(Custom Attach)'}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-cyan-300 font-semibold mb-1">
                              <Users className="w-3 h-3 inline mr-1" />
                              Slot 2: Attached Support Character (11th Ed)
                            </label>
                            <select
                              value={unit.attachedSupportInstanceId || ''}
                              onChange={(e) =>
                                handleUpdateUnit(unit.instanceId, (u) => ({
                                  ...u,
                                  attachedSupportInstanceId: e.target.value || undefined,
                                }))
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                            >
                              <option value="">— No Support Character Attached —</option>
                              {supportLeaderUnits.map((su) => {
                                const sds = datasheetsById.get(su.datasheetId);
                                if (!sds) return null;
                                const isOfficialTarget = sds.canLeadDatasheetIds.includes(ds.id);
                                return (
                                  <option key={su.instanceId} value={su.instanceId}>
                                    {sds.name}{' '}
                                    {isOfficialTarget ? '✓ (Valid Target)' : '(Custom Attach)'}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Enhancements / 11th Ed Unit Upgrades Selector */}
                      {availableEnhancements.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/70">
                          <label className="block text-[10px] uppercase tracking-wider text-purple-300 font-semibold mb-1">
                            {isCharacter
                              ? 'Character Enhancement'
                              : '11th Ed Unit Upgrade / Enhancement'}
                          </label>
                          <select
                            value={unit.enhancementIds[0] || ''}
                            onChange={(e) =>
                              handleUpdateUnit(unit.instanceId, (u) => ({
                                ...u,
                                enhancementIds: e.target.value ? [e.target.value] : [],
                              }))
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white"
                          >
                            <option value="">— None —</option>
                            {availableEnhancements
                              .filter((enh) =>
                                isCharacter ? !enh.isUnitUpgrade : enh.isUnitUpgrade
                              )
                              .map((enh) => (
                                <option key={enh.id} value={enh.id}>
                                  {enh.name} (+{enh.cost} pts · {enh.detachment})
                                  {enh.supportLeaderOverride ? ' [Grants Leader/Support]' : ''}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Equipped Weapons Checkboxes */}
                      {isWeaponsOpen && (
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                          <div className="text-xs font-bold text-slate-300">
                            Select Equipped Weapons for {ds.name}:
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {allUnitWeapons.map((w) => {
                              const currentEquipped =
                                unit.equippedWeaponIds ?? allUnitWeapons.map((x) => x.id);
                              const checked = currentEquipped.includes(w.id);
                              return (
                                <label
                                  key={w.id}
                                  className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const next = checked
                                        ? currentEquipped.filter((id) => id !== w.id)
                                        : [...currentEquipped, w.id];
                                      handleUpdateUnit(unit.instanceId, (u) => ({
                                        ...u,
                                        equippedWeaponIds: next,
                                      }));
                                    }}
                                  />
                                  <span>
                                    {w.name} ({w.type} · A:{w.A} S:{w.S} AP:{w.AP} D:{w.D})
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'import' && (
            <div className="space-y-6">
              {importError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600 text-xs text-rose-200">
                  {importError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  Target Faction for Import
                </label>
                <select
                  value={importFactionId}
                  onChange={async (e) => {
                    const fId = e.target.value;
                    setImportFactionId(fId);
                    await onChangeFaction(fId);
                  }}
                  className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* File Upload (.json / .rosz / .ros) */}
                <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <Upload className="w-4 h-4" />
                    <span>Upload New Recruit (.json / .rosz / .ros)</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Supports structured New Recruit JSON exports, BattleScribe/NewRecruit .rosz ZIP
                    archives, and Lex Tactica JSON backups.
                  </p>
                  <input
                    type="file"
                    accept=".json,.rosz,.ros"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400"
                  />
                </div>

                {/* Plain-Text / JSON Paste */}
                <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <FileText className="w-4 h-4" />
                    <span>Paste Army List Text or JSON</span>
                  </div>
                  <textarea
                    rows={6}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder={`Example:\nCrimson Fists 2000\nLibrarian in Terminator Armour (75 Points)\nTerminator Squad (x5) (175 Points)\nIntercessor Squad (x10) (160 Points)`}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={handlePasteImport}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                  >
                    Import Pasted List
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rosters' && (
            <div className="space-y-3">
              {allRosters.map((r) => (
                <div
                  key={r.id}
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    r.id === roster.id
                      ? 'bg-amber-500/10 border-amber-500'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-white">{r.name}</div>
                    <div className="text-xs text-slate-400">
                      {r.subFactionName ? `${r.subFactionName} · ` : ''}
                      {r.factionId} · {r.totalPoints} pts · {r.units.length} units
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectRoster(r.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
                    >
                      {r.id === roster.id ? 'Active' : 'Load'}
                    </button>
                    {allRosters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteRoster(r.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
