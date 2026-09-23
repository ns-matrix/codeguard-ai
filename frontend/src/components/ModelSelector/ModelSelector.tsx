import { useValidationStore } from '../../stores/validationStore';
import { ChevronDown, Cpu } from 'lucide-react';

export default function ModelSelector() {
  const { model, setModel, ollamaStatus } = useValidationStore();
  const models = ollamaStatus?.models || [];
  const offline = ollamaStatus != null && !ollamaStatus.connected;

  return (
    <div className="relative flex items-center gap-1.5">
      <Cpu className="w-3.5 h-3.5 text-ink-mute shrink-0" />
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        disabled={models.length === 0}
        aria-label="Select model"
        className={`appearance-none rounded-lg border px-2.5 py-1.5 pr-7 text-xs focus:outline-none focus:border-[var(--cg-accent)] cursor-pointer max-w-[180px] truncate ${
          offline
            ? 'bg-dark-900 border-line text-ink-mute cursor-not-allowed'
            : 'bg-dark-800 border-line text-ink-soft'
        }`}
      >
        {models.length > 0 ? (
          models.map((m) => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))
        ) : (
          <option value={model}>{offline ? 'Ollama offline' : 'Loading models…'}</option>
        )}
      </select>
      <ChevronDown className="absolute right-1.5 w-3 h-3 text-ink-mute pointer-events-none" />
    </div>
  );
}
