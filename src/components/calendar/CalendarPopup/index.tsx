import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isSameDay,
  addMonths,
  subMonths,
  isBefore,
  startOfDay,
} from "date-fns";
import { useAppSelector } from "@/store";
import { useClickOutside } from "@/hooks/useClickOutside";
import { IconChevronLeft, IconChevronRight, IconClose } from "@/assets/icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";
import styles from "./CalendarPopup.module.css";

interface Props {
  readonly anchorRef: React.RefObject<HTMLButtonElement>;
  readonly onClose: () => void;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const TIME_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM",
  "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM",
  "05:00 PM", "05:30 PM", "06:00 PM",
];

export function CalendarPopup({ anchorRef, onClose }: Props) {
  const { activeWorkspace } = useAppSelector((s) => s.workspace);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showScheduler, setShowScheduler] = useState(false);

  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[4]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);
  useClickOutside(popupRef, onClose);

  /* Position popup below the anchor button */
  const [pos, setPos] = useState({ top: 0, right: 0 });
  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) {
      const right = window.innerWidth - rect.right;
      const top = rect.bottom + 8;
      setPos({ top, right: Math.max(right, 8) });
    }
  }, [anchorRef]);

  /* Calendar grid helpers */
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startOffset = getDay(monthStart); // 0=Sun … 6=Sat

  const handleDayClick = (day: Date) => {
    if (isBefore(day, startOfDay(new Date()))) return; // disallow past dates
    setSelectedDate(day);
    setShowScheduler(true);
  };

  const handleScheduleSubmit = async () => {
    if (!candidateName.trim()) {
      toast.error("Please enter a candidate name");
      return;
    }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    toast.success(
      `Interview with ${candidateName} scheduled for ${format(selectedDate!, "PPP")} at ${timeSlot}`
    );
    setCandidateName("");
    setCandidateEmail("");
    setNotes("");
    setShowScheduler(false);
    setSelectedDate(null);
    onClose();
  };

  const resetScheduler = () => {
    setShowScheduler(false);
    setSelectedDate(null);
    setCandidateName("");
    setCandidateEmail("");
    setNotes("");
  };

  return createPortal(
    <div
      ref={popupRef}
      className={styles.popup}
      style={{ top: pos.top, right: pos.right }}
      aria-label={showScheduler ? "Schedule interview" : "Calendar"}
      aria-modal="false"
    >
      {showScheduler && selectedDate ? (
        /* ── Interview Scheduler ── */
        <div className={styles.scheduler}>
          <div className={styles.schedulerHeader}>
            <button className={styles.backBtn} onClick={resetScheduler} aria-label="Back to calendar">
              <IconChevronLeft size={16} />
              <span>Back</span>
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <IconClose size={16} />
            </button>
          </div>

          <div className={styles.schedulerBody}>
            <p className={styles.schedulerTitle}>Schedule Interview</p>
            <p className={styles.schedulerDate}>
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </p>

            {activeWorkspace && (
              <p className={styles.workspaceBadge}>{activeWorkspace.name}</p>
            )}

            <div className={styles.formFields}>
              <Input
                label="Candidate Name"
                placeholder="Enter candidate full name"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                showRequired
              />
              <Input
                label="Candidate Email"
                type="email"
                placeholder="candidate@email.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
              />

              <div className={styles.fieldGroup}>
                <label htmlFor="time-slot-group" className={styles.fieldLabel}>Time Slot</label>
                <div id="time-slot-group" className={styles.timeGrid}>
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      className={`${styles.timeSlot} ${timeSlot === slot ? styles.timeSlotActive : ""}`}
                      onClick={() => setTimeSlot(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="interview-notes" className={styles.fieldLabel}>Notes (optional)</label>
                <textarea
                  id="interview-notes"
                  className={styles.notesInput}
                  placeholder="Add interview notes or instructions…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className={styles.schedulerFooter}>
              <Button variant="secondary" size="sm" onClick={resetScheduler}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleScheduleSubmit} isLoading={saving}>
                Schedule Interview
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Monthly Calendar ── */
        <div className={styles.calendar}>
          <div className={styles.calHeader}>
            <button
              className={styles.navBtn}
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
            >
              <IconChevronLeft size={16} />
            </button>
            <span className={styles.monthLabel}>
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              className={styles.navBtn}
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              <IconChevronRight size={16} />
            </button>
          </div>

          <tr className={styles.weekdays}>
            {WEEKDAYS.map((d) => (
              <th key={d} className={styles.weekday} aria-label={d}>
                {d}
              </th>
            ))}
          </tr>

          <table className={styles.grid} role="grid" aria-label={format(currentMonth, "MMMM yyyy")}>
            {/* Empty cells before the 1st day */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <td key={`empty-${i}`} className={styles.emptyCell} role="gridcell" />
            ))}

            {daysInMonth.map((day) => {
              const isPast = isBefore(day, startOfDay(new Date()));
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const today = isToday(day);

              return (
                <td
                  key={format(day, "yyyy-MM-dd")}
                  role="gridcell"
                >
                  <button
                    className={[
                      styles.day,
                      today ? styles.today : "",
                      isSelected ? styles.selected : "",
                      isPast ? styles.past : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => handleDayClick(day)}
                    disabled={isPast}
                    aria-label={format(day, "EEEE, MMMM d, yyyy")}
                    aria-selected={isSelected}
                    aria-current={today ? "date" : undefined}
                  >
                    {format(day, "d")}
                  </button>
                </td>
              );
            })}
          </table>

          <div className={styles.calFooter}>
            <button className={styles.todayBtn} onClick={() => setCurrentMonth(new Date())}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
