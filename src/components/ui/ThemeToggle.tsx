"use client";

import { useTheme } from "@/components/providers/ThemeProvider";

const MODE_LABELS: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  "high-contrast": "High Contrast",
};

const MODE_ICONS: Record<string, string> = {
  light: "\u2600",
  dark: "\u263E",
  "high-contrast": "\u2633",
};

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-sm select-none"
        aria-hidden="true"
      >
        {MODE_ICONS[mode]}
      </span>
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as typeof mode)}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        aria-label="Select theme mode"
      >
        {Object.entries(MODE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
