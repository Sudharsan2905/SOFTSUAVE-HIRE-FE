import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '@/store';
import { Spinner } from '@/components/ui/Spinner';

export default function DashboardPage() {
  const navigate = useNavigate();
  const activeWorkspace = useAppSelector((s) => s.workspace.activeWorkspace);

  useEffect(() => {
    if (activeWorkspace) navigate(`/workspaces/${activeWorkspace.id}/assessments`, { replace: true });
  }, [activeWorkspace, navigate]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Spinner size="lg" />
    </div>
  );
}
