import React, { useState, useEffect, useCallback } from 'react';
import styles from './UsersPage.module.css';
import { Header } from '@/components/layout/Header';
import { FilterBar } from '@/components/shared/FilterBar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { IconPlus, IconUsers } from '@/assets/icons';
import { api } from '@/utils/api';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import { User, PaginationMeta, ViewMode, SortOrder } from '@/types';
import { formatDate, getAvatarColor, getInitials } from '@/utils/helpers';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { page, pageSize, goToPage, reset } = usePagination();
  const debouncedSearch = useDebounce(search, 300);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_order: sortOrder,
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const { data } = await api.get(`/api/users?${params}`);
      setUsers(data.data?.users || []);
      setMeta(data.data?.pagination || null);
    } catch { toast.error('Failed to load users'); }
    finally { setIsLoading(false); }
  }, [page, pageSize, sortOrder, debouncedSearch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { reset(); }, [debouncedSearch, sortOrder]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/users', form);
      toast.success('Admin user created');
      setShowCreate(false);
      setForm({ name: '', email: '', password: '' });
      fetchUsers();
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create user');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <Header
        title="Users"
        subtitle="Manage admin users"
        actions={
          <Button leftIcon={<IconPlus size={16} />} onClick={() => { setForm({ name: '', email: '', password: '' }); setShowCreate(true); }}>
            New Admin
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        sortBy="created_at"
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size="lg" /></div>
      ) : users.length === 0 ? (
        <div className={styles.empty}>
          <IconUsers size={48} color="var(--text-tertiary)" />
          <p>No admin users yet</p>
          <Button leftIcon={<IconPlus size={15} />} onClick={() => setShowCreate(true)}>
            Create first admin
          </Button>
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? styles.grid : styles.list}>
            {users.map((user) => (
              <div key={user.id} className={styles.card}>
                <div className={styles.cardLeft}>
                  <div className={styles.avatar} style={{ background: getAvatarColor(user.name) }}>
                    {getInitials(user.name)}
                  </div>
                  <div className={styles.info}>
                    <p className={styles.name}>{user.name}</p>
                    <p className={styles.email}>{user.email}</p>
                  </div>
                </div>
                <div className={styles.cardRight}>
                  <Badge variant={user.role === 'super_admin' ? 'accent' : 'primary'}>
                    {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </Badge>
                  <span className={styles.date}>{formatDate(user.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
          {meta && <Pagination meta={meta} onPageChange={goToPage} />}
        </>
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Admin User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} isLoading={saving} disabled={!form.name.trim() || !form.email.trim() || !form.password.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Full Name"
            placeholder="e.g., John Doe"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            placeholder="admin@company.com"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          />
          <Input
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
