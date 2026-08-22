import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_PRESET_NAME_LENGTH, MAX_VISIBLE_PRESETS, PRESET_LIMITS } from "../../shared/timerPresets";
import type { TimerPreset, TimerPresetDraft } from "../../shared/types";

const EMPTY_DRAFT: TimerPresetDraft = { name: "", focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 };

type FocusRhythmsProps = {
  presets: TimerPreset[];
  timerActive: boolean;
  onSelect: (id: string) => void;
  onCreate: (draft: TimerPresetDraft) => Promise<string | null>;
  onRemove: (id: string) => Promise<boolean>;
  onReset: () => Promise<boolean>;
};

export function FocusRhythms({ presets, timerActive, onSelect, onCreate, onRemove, onReset }: FocusRhythmsProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<TimerPresetDraft>(EMPTY_DRAFT);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState<{ type: "remove"; preset: TimerPreset } | { type: "reset" } | null>(null);
  const atCapacity = presets.length >= MAX_VISIBLE_PRESETS;

  async function createRhythm() {
    if (creating) return;
    setCreating(true);
    try {
      const error = await onCreate(draft);
      setCreateError(error);
      if (!error) {
        setDraft(EMPTY_DRAFT);
        setCreateOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }

  async function confirmAction() {
    if (confirming) return;
    setConfirming(true);
    try {
      const succeeded = confirmation?.type === "remove" ? await onRemove(confirmation.preset.id) : await onReset();
      if (succeeded) setConfirmation(null);
    } finally {
      setConfirming(false);
    }
  }

  return <section className="settings-section preset-section">
    <div className="section-heading">
      <div><p className="eyebrow">Session rhythm</p><div className="section-title-row"><h2>Choose your focus cycle</h2><span className="info-tooltip">
        <button type="button" className="info-tooltip-trigger" aria-label="Explain session rhythm numbers">i</button><span className="info-tooltip-content" role="tooltip">25 / 5 / 15 means focus, short break, and long break in minutes. A long break follows every fourth completed focus.</span>
      </span></div></div>
      <div className="preset-heading-actions">
        {timerActive && <small>Stop the timer to change rhythm.</small>}
        <button type="button" className="secondary-button reset-rhythms-button" disabled={timerActive} onClick={() => setConfirmation({ type: "reset" })}><RotateCcw aria-hidden="true" />Reset focus cycles</button>
      </div>
    </div>
    <div className="preset-grid">
      {presets.map((preset) => <div key={preset.id} className={`preset-option${preset.isDefault ? " is-selected" : ""}`}>
        <button type="button" className="preset-select-button" disabled={timerActive} onClick={() => onSelect(preset.id)}>
          <strong>{preset.name}</strong><span>{preset.focusMinutes} / {preset.shortBreakMinutes} / {preset.longBreakMinutes}</span><small>Long break every {preset.longBreakEvery}</small>
        </button>
        <button type="button" className="preset-delete-button" disabled={timerActive || presets.length <= 1} title={`Delete ${preset.name}`} aria-label={`Delete ${preset.name}`} onClick={() => setConfirmation({ type: "remove", preset })}><Trash2 aria-hidden="true" /></button>
      </div>)}
      <button type="button" className="preset-option add-preset-card" disabled={timerActive || atCapacity} title={atCapacity ? "Delete a rhythm before creating another one" : "Create a custom rhythm"} onClick={() => { setCreateError(null); setCreateOpen(true); }}><Plus aria-hidden="true" /><span>Create rhythm</span></button>
    </div>
    {createOpen && <CreateRhythmDialog draft={draft} error={createError} submitting={creating} onDraft={(update) => { setCreateError(null); setDraft(update); }} onCancel={() => { setCreateError(null); setCreateOpen(false); }} onCreate={createRhythm} />}
    {confirmation && <RhythmConfirmation action={confirmation} submitting={confirming} onCancel={() => setConfirmation(null)} onConfirm={confirmAction} />}
  </section>;
}

export function CreateRhythmDialog({ draft, error, submitting = false, onDraft, onCancel, onCreate }: { draft: TimerPresetDraft; error: string | null; submitting?: boolean; onDraft: React.Dispatch<React.SetStateAction<TimerPresetDraft>>; onCancel: () => void; onCreate: () => void }) {
  const nameRef = useRef<HTMLInputElement | null>(null);
  useDialogKeyboard(onCancel, nameRef);
  return <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="rhythm-dialog" role="dialog" aria-modal="true" aria-labelledby="rhythm-dialog-title">
      <div className="dialog-heading"><div><p className="eyebrow">New focus cycle</p><h2 id="rhythm-dialog-title">Create a custom rhythm</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={onCancel}><X aria-hidden="true" /></button></div>
      <label className="rhythm-name-field"><span>Short name</span><input ref={nameRef} maxLength={MAX_PRESET_NAME_LENGTH} value={draft.name} placeholder="Writing sprint" onChange={(event) => { const value = event.currentTarget.value; onDraft((current) => ({ ...current, name: value })); }} /><small>{draft.name.length} / {MAX_PRESET_NAME_LENGTH}</small></label>
      <div className="custom-preset-form">
        <DurationInput label="Focus" field="focusMinutes" value={draft.focusMinutes} onChange={onDraft} />
        <DurationInput label="Short break" field="shortBreakMinutes" value={draft.shortBreakMinutes} onChange={onDraft} />
        <DurationInput label="Long break" field="longBreakMinutes" value={draft.longBreakMinutes} onChange={onDraft} />
        <DurationInput label="Long break every" field="longBreakEvery" value={draft.longBreakEvery} onChange={onDraft} />
      </div>
      {error && <p className="rhythm-form-error" role="alert">{error}</p>}
      <div className="confirmation-actions"><button type="button" className="secondary-button" disabled={submitting} onClick={onCancel}>Cancel</button><button type="button" disabled={submitting} onClick={onCreate}>{submitting ? "Creating..." : "Create custom rhythm"}</button></div>
    </section>
  </div>;
}

function RhythmConfirmation({ action, submitting, onCancel, onConfirm }: { action: { type: "remove"; preset: TimerPreset } | { type: "reset" }; submitting: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  useDialogKeyboard(onCancel, cancelRef);
  const reset = action.type === "reset";
  const custom = action.type === "remove" && action.preset.kind === "custom";
  const title = reset ? "Reset all focus cycles?" : `Delete ${action.preset.name}?`;
  const description = reset ? "All custom rhythms will be permanently deleted. The four default rhythms will return and Classic will be selected."
    : custom ? "This custom rhythm will be permanently deleted." : "This default rhythm will be hidden. You can restore it with Reset focus cycles.";
  return <div className="confirmation-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="rhythm-confirm-title">
      <div className="confirmation-icon"><Trash2 aria-hidden="true" /></div><div><p className="eyebrow">Focus cycles</p><h2 id="rhythm-confirm-title">{title}</h2><p>{description}</p></div>
      <div className="confirmation-actions"><button ref={cancelRef} type="button" className="secondary-button" disabled={submitting} onClick={onCancel}>Cancel</button><button type="button" className="confirm-quit-button" disabled={submitting} onClick={onConfirm}>{reset ? <RotateCcw aria-hidden="true" /> : <Trash2 aria-hidden="true" />}{submitting ? "Working..." : reset ? "Reset cycles" : "Delete rhythm"}</button></div>
    </section>
  </div>;
}

type DurationField = keyof typeof PRESET_LIMITS;
function DurationInput({ label, field, value, onChange }: { label: string; field: DurationField; value: number; onChange: React.Dispatch<React.SetStateAction<TimerPresetDraft>> }) {
  const limits = PRESET_LIMITS[field];
  return <label><span>{label}</span><input type="number" min={limits.min} max={limits.max} value={value} onChange={(event) => {
    const nextValue = parseDurationInputValue(event.currentTarget.value);
    onChange((current) => ({ ...current, [field]: nextValue }));
  }} /></label>;
}

function useDialogKeyboard(onCancel: () => void, initialFocus: React.RefObject<HTMLElement | null>) {
  const close = useCallback(onCancel, [onCancel]);
  useEffect(() => {
    initialFocus.current?.focus();
    function handleKeyDown(event: KeyboardEvent) { if (event.key === "Escape") close(); }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, initialFocus]);
}

export function parseDurationInputValue(value: string) { return value === "" ? 0 : Number(value); }
