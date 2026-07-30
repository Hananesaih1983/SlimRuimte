import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MeasurementInput } from "@/components/scan/MeasurementInput";
import { roundCm } from "@/lib/scan/geometry";

/**
 * The interesting behaviour here is the focused/blurred formatting split: the
 * field must NOT reformat under the caret while the user is mid-number, or
 * "4.2" snaps to "4.20" and the ".25" they were about to type is unreachable.
 * Several tests below exist only to pin that down.
 *
 * WHY NO user-event IN THIS FILE
 * ------------------------------
 * user-event v14 installs an interceptor on `HTMLInputElement.prototype`'s
 * `value` setter and keeps its own "UI value" that it treats as authoritative.
 * On a `type="number"` field it then discards React's programmatic re-format,
 * so a blur that correctly rewrites "4.2" to "4.20" still reads back "4.2".
 * Worse, the patch is on the prototype and outlives the test that installed it,
 * so a single `userEvent.setup()` anywhere in the file makes every later
 * `fireEvent` assertion in that file lie too.
 *
 * Both failures this caused were verified against the component with fireEvent
 * in isolation before concluding the component was fine — the alternative was
 * "fixing" correct code to satisfy a test-library artifact.
 */

function setup(props: Partial<Parameters<typeof MeasurementInput>[0]> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <MeasurementInput label="Muur Noord" value={null} onChange={onChange} {...props} />,
  );

  return {
    onChange,
    input: screen.getByLabelText("Muur Noord") as HTMLInputElement,
    ...utils,
  };
}

/** One keystroke: what the browser reports after the character lands. */
function type(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe("MeasurementInput", () => {
  it("renders the initial value formatted to two decimals", () => {
    const { input } = setup({ value: 4.2 });

    expect(input).toHaveValue(4.2);
    expect(input.value).toBe("4.20");
  });

  it("renders empty rather than 0 when there is no measurement yet", () => {
    const { input } = setup({ value: null });

    expect(input.value).toBe("");
  });

  it("shows the accuracy badge", () => {
    setup({ accuracy: "±0.5-2 cm" });

    expect(screen.getByText("±0.5-2 cm")).toBeInTheDocument();
  });

  it("omits the badge when no accuracy is given", () => {
    setup();

    expect(screen.queryByText(/±/)).not.toBeInTheDocument();
  });

  it("renders the unit, defaulting to metres", () => {
    setup();

    expect(screen.getByText("m")).toBeInTheDocument();
  });

  it("uses a numeric keypad, which matters when measuring standing in a room", () => {
    const { input } = setup();

    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("inputMode", "decimal");
  });

  describe("onChange", () => {
    it("fires with the parsed number on input", () => {
      const { input, onChange } = setup();

      type(input, "3.75");

      expect(onChange).toHaveBeenLastCalledWith(3.75);
    });

    it("fires on every keystroke, so live validation keeps up", () => {
      const { input, onChange } = setup();

      type(input, "4");
      type(input, "42");

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenNthCalledWith(1, 4);
      expect(onChange).toHaveBeenNthCalledWith(2, 42);
    });

    it("reports null when the field is cleared, not 0", () => {
      const { input, onChange } = setup({ value: 4.2 });

      type(input, "");

      // 0 would be a measured zero-length wall; null is "not measured yet".
      expect(onChange).toHaveBeenLastCalledWith(null);
    });

    it("accepts a dot decimal, which is what type=number permits", () => {
      const { input, onChange } = setup();

      type(input, "3.5");

      expect(onChange).toHaveBeenLastCalledWith(3.5);
    });

    /**
     * KNOWN ISSUE (medium, NL/BE market) — the comma decimal separator.
     *
     * `handleChange` does `next.trim().replace(",", ".")`, so the intent was
     * clearly to accept "3,5" from a Dutch or Belgian keyboard. With
     * `type="number"` that line is unreachable: the HTML value sanitisation
     * algorithm blanks any value that is not a valid floating-point number, and
     * "3,5" is not one, so the field goes empty and the handler never sees the
     * comma at all.
     *
     * Asserted as-is rather than "fixed" here, because the fix is a product
     * decision, not a test repair: `type="text" inputMode="decimal"` would make
     * the comma work but would drop the browser min/max constraint validation
     * the range tests below rely on. Flagged for the founder.
     */
    it("KNOWN ISSUE: a comma is swallowed by type=number before the handler sees it", () => {
      const { input, onChange } = setup();

      type(input, "3,5");

      expect(input.value).toBe("");
      expect(onChange).not.toHaveBeenCalledWith(3.5);
    });
  });

  describe("range limits", () => {
    it("passes min through to the input so the browser rejects negatives", () => {
      const { input } = setup({ min: 0.1 });

      expect(input).toHaveAttribute("min", "0.1");
    });

    it("passes max through so a 50 m wall cannot be submitted", () => {
      const { input } = setup({ max: 50 });

      expect(input).toHaveAttribute("max", "50");
    });

    it("marks a negative value invalid via constraint validation", () => {
      const { input } = setup({ min: 0.1, max: 50 });

      type(input, "-3");

      expect(input.checkValidity()).toBe(false);
      expect(input.validity.rangeUnderflow).toBe(true);
    });

    it("marks a value above 50 invalid via constraint validation", () => {
      const { input } = setup({ min: 0.1, max: 50 });

      type(input, "51");

      expect(input.checkValidity()).toBe(false);
      expect(input.validity.rangeOverflow).toBe(true);
    });

    it("accepts a value inside the range", () => {
      const { input } = setup({ min: 0.1, max: 50 });

      type(input, "4.2");

      expect(input.checkValidity()).toBe(true);
    });

    it("still reports out-of-range values upward, so the app can show its own error", () => {
      const { input, onChange } = setup({ min: 0.1, max: 50 });

      type(input, "99");

      // The min/max attributes are a browser affordance, not a boundary. The
      // server re-validates in /api/scan/manual-save; see manual-save.test.ts.
      expect(onChange).toHaveBeenLastCalledWith(99);
    });

    it("applies a centimetre step by default", () => {
      const { input } = setup();

      expect(input).toHaveAttribute("step", "0.01");
    });
  });

  describe("formatting while typing", () => {
    it("does not reformat under the caret mid-number", () => {
      const { input, rerender, onChange } = setup();

      fireEvent.focus(input);
      type(input, "4.2");
      // The parent echoes the reported value straight back.
      rerender(<MeasurementInput label="Muur Noord" value={4.2} onChange={onChange} />);

      // "4.20" here would put the caret past the 0 and make "4.25" untypeable.
      expect(input.value).toBe("4.2");
    });

    it("snaps to two decimals on blur", () => {
      const { input, rerender, onChange } = setup();

      fireEvent.focus(input);
      type(input, "4.2");
      rerender(<MeasurementInput label="Muur Noord" value={4.2} onChange={onChange} />);
      fireEvent.blur(input);

      expect(input.value).toBe("4.20");
    });

    it("leaves the field empty on blur when nothing was measured", () => {
      const { input } = setup();

      fireEvent.focus(input);
      type(input, "4.2");
      type(input, "");
      fireEvent.blur(input);

      expect(input.value).toBe("");
    });

    /**
     * The field must show the number the app actually stored, not the raw text
     * the user typed.
     *
     * The wizard's onChange is `updateWall({ length: roundCm(value) })`, and
     * `roundCm` (Math.round(v * 100) / 100) and `Number#toFixed(2)` do not agree
     * on every input. 2.675 is 2.67499999999999982 in IEEE-754, but
     * `2.675 * 100` rounds UP to exactly 270.5... — near enough that the two
     * functions land on different centimetres:
     *
     *   roundCm(2.675)       -> 2.68   (what gets saved)
     *   (2.675).toFixed(2)   -> "2.67" (what the raw text formats to)
     *
     * Formatting the blur from the local text instead of from the prop
     * therefore lets the field display 2.67 m while the saved wall — and the
     * floor plan, the PDF and the contractor brief built from it — say 2.68 m.
     *
     * One centimetre, but it is the one number this whole product sells.
     *
     * (An earlier version of this test used 4.205, where roundCm and toFixed
     * both give 4.21 — no disagreement, so it asserted a premise that
     * `geometry.test.ts` already contradicts. 2.675 is a real divergence.)
     */
    it("shows the value the parent stored, not the raw text, when the two round differently", () => {
      function Harness() {
        const [value, setValue] = useState<number | null>(null);
        return (
          <MeasurementInput
            label="Muur Noord"
            value={value}
            onChange={(next) => setValue(next === null ? null : roundCm(next))}
          />
        );
      }

      render(<Harness />);
      const input = screen.getByLabelText("Muur Noord") as HTMLInputElement;

      fireEvent.focus(input);
      type(input, "2.675");
      fireEvent.blur(input);

      expect(roundCm(2.675)).toBe(2.68);
      expect((2.675).toFixed(2)).toBe("2.67");
      expect(input.value).toBe("2.68");
    });

    it("resyncs when the parent changes the value while unfocused", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <MeasurementInput label="Muur Noord" value={1} onChange={onChange} />,
      );

      rerender(<MeasurementInput label="Muur Noord" value={3.5} onChange={onChange} />);

      expect((screen.getByLabelText("Muur Noord") as HTMLInputElement).value).toBe("3.50");
    });

    it("does not resync under the caret while the field is focused", () => {
      const { input, rerender, onChange } = setup({ value: 1 });

      fireEvent.focus(input);
      type(input, "2.5");
      // A draft restore landing mid-typing must not yank the field away.
      rerender(<MeasurementInput label="Muur Noord" value={9} onChange={onChange} />);

      expect(input.value).toBe("2.5");
    });
  });

  describe("hint and error", () => {
    it("renders a hint and links it to the input", () => {
      const { input } = setup({ hint: "Meet op vloerhoogte." });

      expect(screen.getByText("Meet op vloerhoogte.")).toBeInTheDocument();
      expect(input.getAttribute("aria-describedby")).toBeTruthy();
    });

    it("announces an error and marks the field invalid", () => {
      const { input } = setup({ error: "Muur te kort." });

      expect(screen.getByRole("alert")).toHaveTextContent("Muur te kort.");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("is not marked invalid when there is no error", () => {
      const { input } = setup();

      expect(input).not.toHaveAttribute("aria-invalid");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
