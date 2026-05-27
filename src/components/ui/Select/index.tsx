import React from 'react';
import styles from './Select.module.css';
import { clsx } from '@/utils/helpers';
import { IconChevronDown } from '@/assets/icons';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  hint?: string;
  options: readonly SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
  onChange?: (value: string) => void;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, fullWidth = true, onChange, className, id, ...rest }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');
    return (
      <div className={clsx(styles.wrapper, fullWidth && styles.fullWidth)}>
        {label && <label className={styles.label} htmlFor={inputId}>{label}</label>}
        <div className={clsx(styles.selectWrapper, error && styles.hasError)}>
          <select
            ref={ref}
            id={inputId}
            className={clsx(styles.select, className)}
            onChange={(e) => onChange?.(e.target.value)}
            {...rest}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className={styles.arrow}><IconChevronDown size={14} /></span>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {!error && hint && <p className={styles.hint}>{hint}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
