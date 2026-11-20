"use client";

type StockGaugeMeterProps = {
  title: string;
  description: string;
  ratingLabel: string;
  /** Score from 0 (far left) to 100 (far right) */
  score: number;
  /** Hex color for the active arc, e.g. "#2563EB" or "#4D9A78" */
  arcColor?: string;
};

export function StockGaugeMeter({
  title,
  description,
  ratingLabel,
  score,
  arcColor = "#2563EB",
}: StockGaugeMeterProps) {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Semi-circle geometry: center (110, 105), radius 76
  const cx = 110;
  const cy = 105;
  const radius = 76;
  const circumference = Math.PI * radius; // Half circle length
  const strokeDashoffset =
    circumference - (clampedScore / 100) * circumference;

  // Needle angle: 0 score -> -90 deg (left), 50 score -> 0 deg (up), 100 score -> +90 deg (right)
  const needleAngleDeg = -90 + (clampedScore / 100) * 180;

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-2xs">
      <h3 className="text-base font-medium text-zinc-900">{title}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
        {description}
      </p>

      <div className="mt-5 flex flex-col items-center">
        <svg
          width="220"
          height="120"
          viewBox="0 0 220 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label={`${title}: ${ratingLabel}`}
        >
          {/* Background Gray Semi-Circle Track */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            stroke="#F3F4F6"
            strokeWidth="14"
            strokeLinecap="butt"
          />

          {/* Active Colored Semi-Circle Arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            stroke={arcColor}
            strokeWidth="14"
            strokeLinecap="butt"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />

          {/* Tapered Needle */}
          <g
            transform={`translate(${cx}, ${cy}) rotate(${needleAngleDeg})`}
            className="transition-transform duration-700 ease-out"
          >
            {/* Needle body pointing straight up (0 deg) before rotation */}
            <path
              d="M -2.2 0 L -0.6 -54 L 0.6 -54 L 2.2 0 Z"
              fill="#18181B"
            />
            <circle cx="0" cy="0" r="2.5" fill="#18181B" />
          </g>
        </svg>

        <span className="-mt-1 text-xs font-medium text-zinc-800">
          {ratingLabel}
        </span>
      </div>
    </div>
  );
}

