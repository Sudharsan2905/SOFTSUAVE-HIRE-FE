import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../../../store/hooks';
import { dismissWarning } from '../../../../store/slices/proctoringSlice';
import styles from './MalpracticeWarningModal.module.css';

export function MalpracticeWarningModal() {
  const dispatch = useAppDispatch();
  const { isWarningVisible, warningMessage, malpracticeCount, totalMalpracticeLimit } = useAppSelector(s => s.proctoring);

  useEffect(() => {
    if (!isWarningVisible) return;
    const timer = setTimeout(() => dispatch(dismissWarning()), 5000);
    return () => clearTimeout(timer);
  }, [isWarningVisible, dispatch]);

  if (!isWarningVisible) return null;

  return (
    <div className={styles.overlay} role="alert">
      <div className={styles.modal}>
        <div className={styles.iconWrapper}>
          <span className={styles.warningIcon}>⚠</span>
        </div>
        <h3 className={styles.title}>Warning</h3>
        <p className={styles.message}>{warningMessage}</p>
        <p className={styles.count}>
          {malpracticeCount} / {totalMalpracticeLimit} violations
        </p>
        <button className={styles.dismissBtn} onClick={() => dispatch(dismissWarning())}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
