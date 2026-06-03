import { useEffect, useState } from "react";
import styles from "./CandidateDetailsPage.module.css";
import { clsx, getAvatarColor, getInitials } from "@/utils/helpers";
import { IconChevronsLeft, IconChevronsRight } from "@/assets/icons";
import { CandidateDetailsTabs } from "@/features/candidate/components/CandidateDetailsTabs";

interface CandidateField {
  label: string;
  value: string;
}

// Static placeholder data — to be wired to the real submission later.
const CANDIDATE = {
  firstName: "Sudharsan",
  lastName: "Senthil",
  email: "sudharsan.1234@gmail.com",
  phone: "+91 9876543210",
  gender: "Male",
  dateOfBirth: "12 Jan 2000",
  college: "Anna University",
  collegeCity: "Chennai",
};

const FULL_NAME = `${CANDIDATE.firstName} ${CANDIDATE.lastName}`;

const CANDIDATE_FIELDS: ReadonlyArray<CandidateField> = [
  { label: "Phone", value: CANDIDATE.phone },
  { label: "Gender", value: CANDIDATE.gender },
  { label: "Date of Birth", value: CANDIDATE.dateOfBirth },
  { label: "College / Institution", value: CANDIDATE.college },
  { label: "College City", value: CANDIDATE.collegeCity },
];

export default function CandidateDetailsPage() {
  // Drawer state only governs tablet/mobile. On laptop the card is always shown
  // in-flow via CSS, so the open/close buttons and this state are irrelevant there.
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const closeDrawer = () => setIsDrawerOpen(false);

  // While the drawer is open: close on Escape and lock background scroll.
  useEffect(() => {
    if (!isDrawerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDrawerOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  // Growing past the drawer breakpoint switches back to the always-visible
  // laptop layout — drop any leftover open state so scroll lock is released.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsDrawerOpen(false);
    };

    desktop.addEventListener("change", handleChange);
    return () => desktop.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className={styles.page}>
      {/* Open button — tablet/mobile only (hidden on laptop via CSS). */}
      <button
        type="button"
        className={styles.openBtn}
        onClick={() => setIsDrawerOpen(true)}
        aria-label="Show candidate profile"
      >
        <IconChevronsRight size={16} />
      </button>

      {/* Click-outside backdrop — tablet/mobile only. */}
      <div
        className={clsx(styles.backdrop, isDrawerOpen && styles.backdropOpen)}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      <aside className={clsx(styles.cardWrapper, isDrawerOpen && styles.cardWrapperOpen)}>
        {/* Close button — tablet/mobile only (hidden on laptop via CSS). */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={closeDrawer}
          aria-label="Hide candidate profile"
        >
          <IconChevronsLeft size={16} />
        </button>

        <article className={styles.card}>
          <div className={styles.banner} />

          <div className={styles.identity}>
            <div className={styles.avatar} style={{ background: getAvatarColor(FULL_NAME) }}>
              {getInitials(FULL_NAME)}
            </div>
            <h2 className={styles.name}>{FULL_NAME}</h2>
            <p className={styles.email}>{CANDIDATE.email}</p>
          </div>

          <dl className={styles.details}>
            {CANDIDATE_FIELDS.map((field) => (
              <div key={field.label} className={styles.row}>
                <dt className={styles.label}>{field.label}</dt>
                <dd className={styles.value}>{field.value}</dd>
              </div>
            ))}
          </dl>
        </article>
      </aside>

      <div className={styles.tabsArea}>
        <CandidateDetailsTabs />
      </div>
    </div>
  );
}
