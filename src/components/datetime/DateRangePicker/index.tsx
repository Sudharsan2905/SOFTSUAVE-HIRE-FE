import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isBefore,
  isAfter,
  isSameDay,
  parseISO,
  isSameMonth,
  startOfDay,
  addMonths,
} from "date-fns";
import { IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight } from "@/assets/icons";
import styles from "./DateRangePicker.module.css";

export interface DateRange {
  from: string; // "YYYY-MM-DD" or ""
  to: string; // "YYYY-MM-DD" or ""
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  fullWidth?: boolean;
}

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildTriggerLabel(value: DateRange, placeholder: string): string {
  if (value.from && value.to) {
    const f = parseISO(value.from);
    const t = parseISO(value.to);
    return `${format(f, "MMM d")} – ${format(t, "MMM d, yyyy")}`;
  }
  if (value.from) return `From: ${format(parseISO(value.from), "MMM d, yyyy")}`;
  return placeholder;
}

// Fix S3776: extract class-name computation outside the component to reduce cognitive complexity
function getDayClassNames(
  day: Date,
  fromParsed: Date | null,
  toParsed: Date | null,
  hoverParsed: Date | null,
  selectionPhase: "from" | "to",
  today: Date,
  viewDate: Date
): string {
  const isFrom = !!(fromParsed && isSameDay(day, fromParsed));
  const isTo = !!(toParsed && isSameDay(day, toParsed));
  const isInRange = !!(
    fromParsed &&
    toParsed &&
    isAfter(day, fromParsed) &&
    isBefore(day, toParsed)
  );
  const isHoverRange = !!(
    selectionPhase === "to" &&
    fromParsed &&
    hoverParsed &&
    isAfter(day, fromParsed) &&
    isBefore(day, hoverParsed)
  );
  const isDisabled = !!(
    selectionPhase === "to" &&
    fromParsed &&
    isBefore(day, fromParsed) &&
    !isSameDay(day, fromParsed)
  );
  const isToday = isSameDay(day, today);
  const isOutsideMonth = !isSameMonth(day, viewDate);

  return [
    styles.calDay,
    isFrom || isTo ? styles.calDaySelected : "",
    isInRange ? styles.calDayInRange : "",
    isHoverRange ? styles.calDayHoverRange : "",
    isToday && !isFrom && !isTo ? styles.calDayToday : "",
    isOutsideMonth ? styles.calDayOutside : "",
    isDisabled ? styles.calDayDisabled : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  disabled = false,
  className,
  label,
  fullWidth = false,
}: Readonly<DateRangePickerProps>) {
  const today = useMemo(() => startOfDay(addMonths(startOfDay(addMonths(new Date(), 0)), 0)), []);

  const [open, setOpen] = useState(false);
  const [hoverDate, setHoverDate] = useState("");
  const [viewDate, setViewDate] = useState(() => startOfMonth(today));
  const [selectionPhase, setSelectionPhase] = useState<"from" | "to">("from");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewDate)),
    end: endOfWeek(endOfMonth(viewDate)),
  });

  const handleDayClick = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const fromParsed = value.from ? parseISO(value.from) : null;
    if (
      selectionPhase === "from" ||
      (fromParsed && isBefore(day, fromParsed) && !isSameDay(day, fromParsed))
    ) {
      onChange({ from: dayStr, to: "" });
      setSelectionPhase("to");
    } else {
      onChange({ from: value.from, to: dayStr });
      setSelectionPhase("from");
      setOpen(false);
      setHoverDate("");
    }
  };

  const handleClear = () => {
    onChange({ from: "", to: "" });
    setSelectionPhase("from");
    setHoverDate("");
  };

  const triggerLabel = buildTriggerLabel(value, placeholder);
  const isPlaceholder = !value.from && !value.to;

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper} ${fullWidth ? styles.fullWidth : ""} ${className ?? ""}`}
    >
      {label && <span className={styles.label}>{label}</span>}
      <button
        type="button"
        className={styles.trigger}
        onClick={() => !disabled && setOpen((p) => !p)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.triggerLeft}>
          <IconCalendar size={15} className={styles.calendarIcon} />
          <span className={isPlaceholder ? styles.triggerPlaceholder : ""}>{triggerLabel}</span>
        </span>
        <IconChevronDown size={14} />
      </button>

      {open && (
        <section className={styles.popup} aria-label="Date range picker">
          {/* Month navigation */}
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
              const dayStr = format(day, "yyyy-MM-dd");
              const fromParsed = value.from ? parseISO(value.from) : null;
              const toParsed = value.to ? parseISO(value.to) : null;
              const hoverParsed = hoverDate ? parseISO(hoverDate) : null;

              const isSelected = !!(
                (fromParsed && isSameDay(day, fromParsed)) ||
                (toParsed && isSameDay(day, toParsed))
              );
              const isDisabled = !!(
                selectionPhase === "to" &&
                fromParsed &&
                isBefore(day, fromParsed) &&
                !isSameDay(day, fromParsed)
              );

              // Fix S3776: use extracted helper for class computation
              const cls = getDayClassNames(
                day,
                fromParsed,
                toParsed,
                hoverParsed,
                selectionPhase,
                today,
                viewDate
              );

              return (
                <button
                  key={dayStr}
                  type="button"
                  className={cls}
                  onClick={() => !isDisabled && handleDayClick(day)}
                  disabled={isDisabled}
                  onMouseEnter={() =>
                    selectionPhase === "to" && !isDisabled && setHoverDate(dayStr)
                  }
                  onMouseLeave={() => setHoverDate("")}
                  aria-label={format(day, "PPP")}
                  aria-pressed={isSelected}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className={styles.calFooter}>
            <span className={styles.calPhaseLabel}>
              {selectionPhase === "from" ? "Pick start date" : "Pick end date"}
            </span>
            <button type="button" className={styles.calClearBtn} onClick={handleClear}>
              Clear
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
