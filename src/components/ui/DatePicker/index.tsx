import React, { useState, useRef, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import {
  format,
  getDaysInMonth,
  startOfMonth,
  getDay,
  isToday,
  isBefore,
  startOfDay,
  setMonth,
  setYear,
  addMonths,
  subMonths,
  parse,
  isValid,
} from "date-fns";
import styles from "./DatePicker.module.css";
import { clsx } from "@/utils/helpers";
import { IconChevronLeft, IconChevronRight } from "@/assets/icons";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface DatePickerProps {
  label?: string;
  value?: string; // ISO string "YYYY-MM-DD" or ""
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  showRequired?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = "Select date",
  showRequired,
  disabled,
  id,
  name,
}: Readonly<DatePickerProps>) {
  const uid = useId();
  const inputId = id ?? `datepicker-${uid}`;

  const today = startOfDay(new Date());

  const parsedValue = value
    ? (() => {
        const d = parse(value, "yyyy-MM-dd", new Date());
        return isValid(d) ? d : null;
      })()
    : null;

  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(parsedValue ?? new Date(today.getFullYear() - 20, 0, 1));
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [yearInput, setYearInput] = useState("");
  const [showYearInput, setShowYearInput] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const openCalendar = () => {
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popupH = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < popupH + 8 && rect.top > spaceBelow;

      setPopupStyle({
        position: "fixed",
        left: rect.left,
        width: Math.max(rect.width, 280),
        zIndex: 9999,
        ...(openUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
      if (parsedValue) setViewDate(startOfMonth(parsedValue));
    }
    setIsOpen((v) => !v);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!popupRef.current?.contains(t) && !triggerRef.current?.contains(t)) {
        setIsOpen(false);
        setShowYearInput(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const selectDay = (day: number) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (isBefore(today, selected)) return; // future date guard
    onChange?.(format(selected, "yyyy-MM-dd"));
    setIsOpen(false);
    setShowYearInput(false);
  };

  const prevMonth = () => setViewDate((d) => subMonths(d, 1));
  const nextMonth = () => {
    const next = addMonths(viewDate, 1);
    if (!isBefore(startOfMonth(next), startOfMonth(today)) && next > today) return;
    setViewDate(next);
  };

  const canGoNext = isBefore(addMonths(startOfMonth(viewDate), 1), startOfMonth(today))
    || (viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() < today.getMonth());

  const handleYearSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const yr = parseInt(yearInput, 10);
    if (!isNaN(yr) && yr >= 1900 && yr <= today.getFullYear()) {
      setViewDate(setYear(viewDate, yr));
    }
    setShowYearInput(false);
    setYearInput("");
  };

  const handleMonthSelect = (monthIdx: number) => {
    let next = setMonth(viewDate, monthIdx);
    if (next > today) next = setMonth(viewDate, today.getMonth());
    setViewDate(next);
  };

  // Build calendar grid
  const firstDayOfWeek = getDay(startOfMonth(viewDate));
  const daysInMonth = getDaysInMonth(viewDate);
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const isFutureDay = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return d > today;
  };

  const isSelectedDay = (day: number) => {
    if (!parsedValue) return false;
    return (
      parsedValue.getFullYear() === viewDate.getFullYear() &&
      parsedValue.getMonth() === viewDate.getMonth() &&
      parsedValue.getDate() === day
    );
  };

  const isTodayDay = (day: number) => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return isToday(d);
  };

  const displayValue = parsedValue ? format(parsedValue, "dd MMM yyyy") : "";

  return (
    <div className={styles.wrapper}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {showRequired && <span style={{ color: "var(--error-500)", marginLeft: 2 }}>*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        id={inputId}
        name={name}
        className={clsx(styles.trigger, error && styles.triggerError, disabled && styles.disabled)}
        onClick={openCalendar}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className={clsx(styles.triggerText, !displayValue && styles.triggerPlaceholder)}>
          {displayValue || placeholder}
        </span>
        <CalendarIcon />
      </button>

      {error && <p className={styles.error}>{error}</p>}
      {!error && hint && <p className={styles.hint}>{hint}</p>}

      {isOpen &&
        createPortal(
          <div
            ref={popupRef}
            className={styles.popup}
            style={popupStyle}
            role="region"
            aria-label="Date picker calendar"
          >
            {/* Header */}
            <div className={styles.header}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={prevMonth}
                aria-label="Previous month"
              >
                <IconChevronLeft size={16} />
              </button>

              <div className={styles.headerCenter}>
                {showYearInput ? (
                  <form onSubmit={handleYearSubmit} className={styles.yearForm}>
                    <input
                      type="number"
                      className={styles.yearInput}
                      value={yearInput}
                      onChange={(e) => setYearInput(e.target.value)}
                      placeholder={String(viewDate.getFullYear())}
                      min={1900}
                      max={today.getFullYear()}
                      autoFocus
                    />
                    <button type="submit" className={styles.yearOk}>OK</button>
                  </form>
                ) : (
                  <>
                    <select
                      className={styles.monthSelect}
                      value={viewDate.getMonth()}
                      onChange={(e) => handleMonthSelect(Number(e.target.value))}
                      aria-label="Select month"
                    >
                      {MONTHS.map((m, i) => (
                        <option
                          key={m}
                          value={i}
                          disabled={
                            viewDate.getFullYear() === today.getFullYear() && i > today.getMonth()
                          }
                        >
                          {m}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.yearBtn}
                      onClick={() => {
                        setYearInput(String(viewDate.getFullYear()));
                        setShowYearInput(true);
                      }}
                      aria-label="Edit year"
                    >
                      {viewDate.getFullYear()}
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                className={clsx(styles.navBtn, !canGoNext && styles.navDisabled)}
                onClick={nextMonth}
                disabled={!canGoNext}
                aria-label="Next month"
              >
                <IconChevronRight size={16} />
              </button>
            </div>

            {/* Weekday labels */}
            <div className={styles.weekdays}>
              {WEEKDAYS.map((d) => (
                <span key={d} className={styles.weekday}>{d}</span>
              ))}
            </div>

            {/* Days grid */}
            <div className={styles.grid}>
              {blanks.map((i) => (
                <span key={`b-${i}`} className={styles.blank} />
              ))}
              {days.map((day) => {
                const future = isFutureDay(day);
                const selected = isSelectedDay(day);
                const todayMark = isTodayDay(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className={clsx(
                      styles.day,
                      selected && styles.daySelected,
                      todayMark && !selected && styles.dayToday,
                      future && styles.dayDisabled
                    )}
                    onClick={() => !future && selectDay(day)}
                    disabled={future}
                    aria-label={format(
                      new Date(viewDate.getFullYear(), viewDate.getMonth(), day),
                      "d MMMM yyyy"
                    )}
                    aria-pressed={selected}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Footer — today shortcut */}
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.todayBtn}
                onClick={() => {
                  setViewDate(startOfMonth(today));
                  onChange?.(format(today, "yyyy-MM-dd"));
                  setIsOpen(false);
                }}
              >
                Today
              </button>
              {parsedValue && (
                <button
                  type="button"
                  className={styles.clearBtn}
                  onClick={() => {
                    onChange?.("");
                    setIsOpen(false);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

