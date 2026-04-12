interface ProgressBarProps {
  percentage: number;
  label?: string;
  height?: 'sm' | 'md' | 'lg';
}

const heightClasses = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-5',
};

function getBarColor(percentage: number): string {
  if (percentage <= 0) return 'bg-zinc-700';
  if (percentage >= 100) return 'bg-green-500';
  return 'bg-blue-500';
}

export function ProgressBar({ percentage, label, height = 'md' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const barColor = getBarColor(clamped);
  const heightClass = heightClasses[height];

  return (
    <div className="w-full">
      <div className={`w-full bg-zinc-800 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`${heightClass} ${barColor} rounded-full transition-all duration-500 ease-in-out`}
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {label && (
        <p className="text-xs text-zinc-400 mt-1">{label}</p>
      )}
    </div>
  );
}
