import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
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

function parseValue(value: string): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/** Compose a datetime-local string from a calendar date + 12-hour time parts. */
function compose(date: Date, hour12: number, minute: number, ampm: "AM" | "PM"): string {
  let h = hour12 % 12;
  if (ampm === "PM") h += 12;
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
  // Fixed-position coordinates for the portalled popup (escapes modal overflow clipping).
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [viewDate, setViewDate] = useState(() => startOfMonth(parsed ?? today));
  // Time selection lives locally so the user can pick a time before a day.
  const [hour12, setHour12] = useState(() => (parsed ? ((parsed.getHours() + 11) % 12) + 1 : 12));
  const [minute, setMinute] = useState(() => (parsed ? parsed.getMinutes() : 0));
  const [ampm, setAmpm] = useState<"AM" | "PM">(() =>
    parsed && parsed.getHours() >= 12 ? "PM" : "AM"
  );

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Sync local time state when the value changes from outside.
  useEffect(() => {
    if (!parsed) return;
    setHour12(((parsed.getHours() + 11) % 12) + 1);
    setMinute(parsed.getMinutes());
    setAmpm(parsed.getHours() >= 12 ? "PM" : "AM");
    setViewDate(startOfMonth(parsed));
  }, [value]);

  // Position the fixed popup relative to the trigger, flipping/aligning so it
  // stays inside the viewport. Runs on open and on scroll/resize while open.
  useLayoutEffect(() => {
    if (!open) return;

    const reposition = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      if (!t) return;
      const margin = 8;
      const ph = popupRef.current?.offsetHeight ?? 300;
      const pw = popupRef.current?.offsetWidth ?? 410;

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
    // capture: true so we catch scrolls on the modal body / any ancestor.
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, value]);

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

  const handleOpen = () => {
    if (disabled) return;
    if (!open) setCoords(null); // hide until positioned to avoid a flash at (0,0)
    setOpen((p) => !p);
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate)),
    end: endOfWeek(endOfMonth(viewDate)),
  });

  const emit = (date: Date, h: number, m: number, ap: "AM" | "PM") => {
    onChange(compose(date, h, m, ap));
  };

  const handleDayClick = (day: Date) => {
    emit(day, hour12, minute, ampm);
  };

  const setTimePart = (next: { h?: number; m?: number; ap?: "AM" | "PM" }) => {
    const h = next.h ?? hour12;
    const m = next.m ?? minute;
    const ap = next.ap ?? ampm;
    setHour12(h);
    setMinute(m);
    setAmpm(ap);
    // Only emit once a calendar day has been chosen.
    if (parsed) emit(parsed, h, m, ap);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

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
          <section
            ref={popupRef}
            className={styles.popup}
            style={{
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              visibility: coords ? "visible" : "hidden",
            }}
            aria-label="Date and time picker"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Calendar */}
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
                    !isSameMonth(day, viewDate) ? styles.calDayOutside : "",
                    isDisabled ? styles.calDayDisabled : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={format(day, "yyyy-MM-dd")}
                      type="button"
                      className={cls}
                      onClick={() => !isDisabled && handleDayClick(day)}
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

            {/* Time — only shown once a calendar day has been selected. */}
            {parsed && (
              <div className={styles.time}>
                <span className={styles.timeTitle}>Time</span>
                <div className={styles.timeCols}>
                  <div className={styles.timeScroll}>
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={`${styles.timeOpt} ${h === hour12 ? styles.timeOptActive : ""}`}
                        onClick={() => setTimePart({ h })}
                      >
                        {pad(h)}
                      </button>
                    ))}
                  </div>
                  <div className={styles.timeScroll}>
                    {MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`${styles.timeOpt} ${m === minute ? styles.timeOptActive : ""}`}
                        onClick={() => setTimePart({ m })}
                      >
                        {pad(m)}
                      </button>
                    ))}
                  </div>
                  <div className={`${styles.timeScroll} ${styles.ampmCol}`}>
                    {(["AM", "PM"] as const).map((ap) => (
                      <button
                        key={ap}
                        type="button"
                        className={`${styles.timeOpt} ${ap === ampm ? styles.timeOptActive : ""}`}
                        onClick={() => setTimePart({ ap })}
                      >
                        {ap}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.footer}>
                  <span className={styles.hint}>
                    {parsed ? format(parsed, "MMM d, h:mm a") : "Pick a date to apply time"}
                  </span>
                  <button type="button" className={styles.clearBtn} onClick={handleClear}>
                    Clear
                  </button>
                </div>
              </div>
            )}
          </section>,
          document.body
        )}
    </div>
  );
}
