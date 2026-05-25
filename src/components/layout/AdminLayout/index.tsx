import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import styles from './AdminLayout.module.css';
import { useAppSelector } from '@/store';
import { Sidebar } from '../Sidebar';

export function AdminLayout() {
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (user?.role === 'candidate') return <Navigate to="/login" replace />;

  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
