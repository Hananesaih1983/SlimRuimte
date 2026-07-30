"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Controlled metric measurement field.
 *
 * The formatting is the fiddly part. Displaying `value.toFixed(2)` on every
 * render makes the field unusable: typing "4.2" reformats to "4.20" after the
 * "4.2" keystroke and the caret jumps, so the user can never reach "4.25". So
 * the field keeps its own raw text while focused and only snaps to two decimals
 * on blur, reporting parsed numbers upward on every keystroke either way.
 *
 * `inputMode="decimal"` gets the numeric keypad on mobile, which matters — this
 * is used standing in a room holding a laser measure.
 */

type Props = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Badge rendered beside the input, e.g. "±0.5-2 cm". */
  accuracy?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  error?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  name?: string;
};

export function MeasurementInput({
  label,
  value,
  onChange,
  accuracy,
  unit = "m",
  min,
  max,
  step = 0.01,
  hint,
  error,
  placeholder,
  autoFocus,
  name,
}: Props) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const [text, setText] = useState(() => formatValue(value));
  const focused = useRef(false);

  // Resync when the parent changes the value from elsewhere (draft restore,
  // reset, step navigation) — but never while typing, which would fight the user.
  useEffect(() => {
    if (focused.current) return;
    setText(formatValue(value));
  }, [value]);

  function handleChange(next: string) {
    setText(next);

    const trimmed = next.trim().replace(",", ".");
    if (trimmed === "") {
      onChange(null);
      return;
    }

    const parsed = Number.parseFloat(trimmed);
    onChange(Number.isFinite(parsed) ? parsed : null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        {accuracy ? (
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {accuracy}
          </span>
        ) : null}
      </div>

      <div className="relative">
        <input
          id={inputId}
          name={name}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={text}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(hint && hintId, error && errorId) || undefined}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            const parsed = Number.parseFloat(text.trim());
            setText(Number.isFinite(parsed) ? parsed.toFixed(2) : formatValue(value));
          }}
          onChange={(event) => handleChange(event.target.value)}
          className={cn(
            "h-11 w-full rounded-lg border bg-background pr-10 pl-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            error
              ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
              : "border-border focus-visible:border-ring",
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {unit}
        </span>
      </div>

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function formatValue(value: number | null): string {
  return value !== null && Number.isFinite(value) ? value.toFixed(2) : "";
}
