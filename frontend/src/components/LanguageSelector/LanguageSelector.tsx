import { useValidationStore } from '../../stores/validationStore';
import { ChevronDown, Languages } from 'lucide-react';

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'bash', label: 'Bash' },
];

export default function LanguageSelector() {
  const { language, setLanguage } = useValidationStore();

  return (
    <div className="relative flex items-center gap-1.5">
      <Languages className="w-3.5 h-3.5 text-ink-mute shrink-0" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        aria-label="Select language"
        className="appearance-none rounded-lg border border-line bg-dark-800 px-2.5 py-1.5 pr-7 text-xs text-ink-soft focus:outline-none focus:border-[var(--cg-accent)] cursor-pointer"
      >
        {LANGUAGES.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-1.5 w-3 h-3 text-ink-mute pointer-events-none" />
    </div>
  );
}
