'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // session may already be gone — clearing the client state is enough
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={onLogout} disabled={pending}>
      {label}
    </Button>
  );
}
