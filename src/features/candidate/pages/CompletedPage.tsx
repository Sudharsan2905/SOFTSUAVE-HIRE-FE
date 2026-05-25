import React from 'react';
import styles from './CompletedPage.module.css';
import { IconCheck } from '@/assets/icons';

export default function CompletedPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <IconCheck size={32} color="#fff" />
        </div>
        <h1 className={styles.title}>Assessment Submitted!</h1>
        <p className={styles.subtitle}>
          Thank you for completing the assessment. Your responses have been recorded and will be reviewed by the hiring team.
        </p>
        <p className={styles.note}>
          You will be contacted if you are shortlisted for the next stage. You may now close this window.
        </p>
        <div className={styles.logo}>
          <span className={styles.logoMark}>S</span>
          <span className={styles.logoText}>SoftSuave Hire</span>
        </div>
      </div>
    </div>
  );
}
