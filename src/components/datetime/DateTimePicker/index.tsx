import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isBefore,
  isSameDay,
  parseISO,
  isSameMonth,
  isValid,
  startOfDay,
  addMonths,
} from "date-fns";
import { IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight } from "@/assets/icons";
import styles from "./DateTimePicker.module.css";

interface DateTimePickerProps {
  /** datetime-local value: "YYYY-MM-DDTHH:mm" or "" */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  /** Earliest selectable date-time, same "YYYY-MM-DDTHH:mm" format. */
  min?: string;
  id?: string;
  className?: string;
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59

const pad = (n: number) => String(n).padStart(2, "0");

/** Convert 12-hour + AM/PM to 0-23 hour. */
const to24h = (h12: number, ap: "AM" | "PM"): number => (h12 % 12) + (ap === "PM" ? 12 : 0);

function parseValue(value: string): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/** Compose a datetime-local string from a calendar date + 12-hour time parts. */
function compose(date: Date, hour12: number, minute: number, ampm: "AM" | "PM"): string {
  const h = to24h(hour12, ampm);
  return `${format(date, "yyyy-MM-dd")}T${pad(h)}:${pad(minute)}`;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time",
  disabled = false,
  label,
  error,
  min,
  id,
  className,
}: Readonly<DateTimePickerProps>) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const parsed = parseValue(value);
  const minDate = parseValue(min ?? "");

  const [open, setOpen] = useState(false);
  /** "date" shows the calendar; "time" shows the time-selection columns. */
  const [step, setStep] = useState<"date" | "time">("date");
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [viewDate, setViewDate] = useState(() => startOfMonth(parsed ?? today));
  const [hour12, setHour12] = useState(() => (parsed ? ((parsed.getHours() + 11) % 12) + 1 : 12));
  const [minute, setMinute] = useState(() => (parsed ? parsed.getMinutes() : 0));
  const [ampm, setAmpm] = useState<"AM" | "PM">(() =>
    parsed && parsed.getHours() >= 12 ? "PM" : "AM"
  );

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDialogElement>(null);

  // ── Min-day time constraints ────────────────────────────────────────────────

  const isOnMinDay = !!(parsed && minDate && isSameDay(parsed, minDate));
  const minH24 = minDate?.getHours() ?? 0;
  const minMin = minDate?.getMinutes() ?? 0;

  /** Is this hour (1-12) disabled given the current AM/PM? */
  const isHourDisabled = useCallback(
    (h: number): boolean => isOnMinDay && to24h(h, ampm) < minH24,
    [isOnMinDay, ampm, minH24]
  );

  /** Is this AM/PM option entirely disabled? (All its hours are in the past.) */
  const isAmpmDisabled = useCallback(
    (ap: "AM" | "PM"): boolean => isOnMinDay && ap === "AM" && minH24 >= 12,
    [isOnMinDay, minH24]
  );

  /** Is this minute disabled for the current hour/ampm? */
  const isMinuteDisabled = useCallback(
    (m: number): boolean => {
      if (!isOnMinDay) return false;
      const h24 = to24h(hour12, ampm);
      if (h24 < minH24) return true;
      if (h24 > minH24) return false;
      return m < minMin;
    },
    [isOnMinDay, hour12, ampm, minH24, minMin]
  );

  // ── Sync local time state when value changes from outside ──────────────────

  useEffect(() => {
    if (!parsed) return;
    setHour12(((parsed.getHours() + 11) % 12) + 1);
    setMinute(parsed.getMinutes());
    setAmpm(parsed.getHours() >= 12 ? "PM" : "AM");
    setViewDate(startOfMonth(parsed));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Popup positioning ───────────────────────────────────────────────────────

  useLayoutEffect(() => {
    if (!open) return;

    const reposition = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      if (!t) return;
      const margin = 8;
      const ph = popupRef.current?.offsetHeight ?? 300;
      const pw = popupRef.current?.offsetWidth ?? 260;

      const spaceBelow = window.innerHeight - t.bottom;
      const top =
        spaceBelow < ph + margin && t.top > spaceBelow
          ? Math.max(margin, t.top - ph - 6)
          : t.bottom + 6;

      let left = t.left;
      if (left + pw > window.innerWidth - margin) left = t.right - pw;
      left = Math.max(margin, Math.min(left, window.innerWidth - pw - margin));

      setCoords({ top, left });
    };

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, value, step]); // reposition when step changes (popup size changes)

  // ── Outside-click to close ──────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!wrapperRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleOpen = () => {
    if (disabled) return;
    if (!open) {
      setCoords(null); // hide until positioned to avoid flash at (0,0)
      setStep("date"); // always start at the calendar step
    }
    setOpen((p) => !p);
  };

  const emit = (date: Date, h: number, m: number, ap: "AM" | "PM") => {
    onChange(compose(date, h, m, ap));
  };

  /** Clicking a calendar day advances to the time step. */
  const handleDayClick = (day: Date) => {
    emit(day, hour12, minute, ampm);
    setStep("time");
  };

  const setTimePart = (next: { h?: number; m?: number; ap?: "AM" | "PM" }) => {
    const h = next.h ?? hour12;
    const m = next.m ?? minute;
    const ap = next.ap ?? ampm;

    // Reject clicks on disabled time options.
    if (next.h !== undefined && isHourDisabled(h)) return;
    if (next.ap !== undefined && isAmpmDisabled(ap)) return;
    if (next.m !== undefined && isMinuteDisabled(m)) return;

    setHour12(h);
    setMinute(m);
    setAmpm(ap);
    if (parsed) emit(parsed, h, m, ap);
  };

  const handleClear = () => {
    onChange("");
    setStep("date");
    setOpen(false);
  };

  // ── Calendar day grid ───────────────────────────────────────────────────────

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate)),
    end: endOfWeek(endOfMonth(viewDate)),
  });

  const triggerLabel = parsed ? format(parsed, "MMM d, yyyy · h:mm a") : placeholder;

  return (
    <div ref={wrapperRef} className={`${styles.wrapper} ${className ?? ""}`}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`${styles.trigger} ${error ? styles.triggerError : ""}`}
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={styles.triggerLeft}>
          <IconCalendar size={15} className={styles.calendarIcon} />
          <span className={parsed ? "" : styles.triggerPlaceholder}>{triggerLabel}</span>
        </span>
        <IconChevronDown size={14} />
      </button>

      {error && <span className={styles.errorText}>{error}</span>}

      {open &&
        createPortal(
          <dialog
            ref={popupRef}
            open
            className={styles.popup}
            style={{
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              visibility: coords ? "visible" : "hidden",
            }}
            aria-label="Date and time picker"
          >
            {/* ── Step 1: Calendar ─────────────────────────────────────── */}
            {step === "date" && (
              <div className={styles.calendar}>
                <div className={styles.calNav}>
                  <button
                    type="button"
                    className={styles.calNavBtn}
                    onClick={() => setViewDate((d) => addMonths(d, -1))}
                    aria-label="Previous month"
                  >
                    <IconChevronLeft size={14} />
                  </button>
                  <span className={styles.calTitle}>{format(viewDate, "MMMM yyyy")}</span>
                  <button
                    type="button"
                    className={styles.calNavBtn}
                    onClick={() => setViewDate((d) => addMonths(d, 1))}
                    aria-label="Next month"
                  >
                    <IconChevronRight size={14} />
                  </button>
                </div>

                <div className={styles.calGrid} aria-label={format(viewDate, "MMMM yyyy")}>
                  {DAY_LABELS.map((d) => (
                    <div key={d} className={styles.calDayHeader}>
                      {d}
                    </div>
                  ))}
                  {days.map((day) => {
                    const isSelected = !!(parsed && isSameDay(day, parsed));
                    const isDisabled = !!(
                      minDate &&
                      isBefore(day, startOfDay(minDate)) &&
                      !isSameDay(day, minDate)
                    );
                    const cls = [
                      styles.calDay,
                      isSelected ? styles.calDaySelected : "",
                      isSameDay(day, today) && !isSelected ? styles.calDayToday : "",
                      isSameMonth(day, viewDate) ? "" : styles.calDayOutside,
                      isDisabled ? styles.calDayDisabled : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <button
                        key={format(day, "yyyy-MM-dd")}
                        type="button"
                        className={cls}
                        onClick={isDisabled ? undefined : () => handleDayClick(day)}
                        disabled={isDisabled}
                        aria-label={format(day, "PPP")}
                        aria-pressed={isSelected}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 2: Time ─────────────────────────────────────────── */}
            {step === "time" && (
              <div className={styles.timeStep}>
                {/* Navigation row: Back | Select Time | Clear */}
                <div className={styles.timeStepNav}>
                  <button
                    type="button"
                    className={styles.timeBackBtn}
                    onClick={() => setStep("date")}
                  >
                    <IconChevronLeft size={13} />
                    Back
                  </button>
                  <span className={styles.timeStepTitle}>Select Time</span>
                  <button type="button" className={styles.clearBtn} onClick={handleClear}>
                    Clear
                  </button>
                </div>

                <div className={styles.timeCols}>
                  {/* Hours */}
                  <div className={styles.timeScroll}>
                    {HOURS.map((h) => {
                      const disabled = isHourDisabled(h);
                      return (
                        <button
                          key={h}
                          type="button"
                          disabled={disabled}
                          className={[
                            styles.timeOpt,
                            h === hour12 ? styles.timeOptActive : "",
                            disabled ? styles.timeOptDisabled : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => setTimePart({ h })}
                        >
                          {pad(h)}
                        </button>
                      );
                    })}
                  </div>

                  {/* Minutes */}
                  <div className={styles.timeScroll}>
                    {MINUTES.map((m) => {
                      const disabled = isMinuteDisabled(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          disabled={disabled}
                          className={[
                            styles.timeOpt,
                            m === minute ? styles.timeOptActive : "",
                            disabled ? styles.timeOptDisabled : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => setTimePart({ m })}
                        >
                          {pad(m)}
                        </button>
                      );
                    })}
                  </div>

                  {/* AM / PM */}
                  <div className={`${styles.timeScroll} ${styles.ampmCol}`}>
                    {(["AM", "PM"] as const).map((ap) => {
                      const disabled = isAmpmDisabled(ap);
                      return (
                        <button
                          key={ap}
                          type="button"
                          disabled={disabled}
                          className={[
                            styles.timeOpt,
                            ap === ampm ? styles.timeOptActive : "",
                            disabled ? styles.timeOptDisabled : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => setTimePart({ ap })}
                        >
                          {ap}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer: current selection hint */}
                <div className={styles.footer}>
                  <span className={styles.hint}>
                    {parsed ? format(parsed, "MMM d, yyyy · h:mm a") : "Pick a date first"}
                  </span>
                </div>
              </div>
            )}
          </dialog>,
          document.body
        )}
    </div>
  );
}
