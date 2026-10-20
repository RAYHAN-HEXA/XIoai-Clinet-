'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export function LogoutButton({ label }: { label: string }) {
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // session may already be gone — clearing the client state is enough
    }
    // Full navigation (not router.push): the logout response just cleared the
    // session cookie, and a hard load bypasses the Router Cache so the
    // middleware sees an unauthenticated request and lands on the landing page.
    window.location.assign('/');
  }

  return (
    <Button variant="ghost" size="sm" onClick={onLogout} disabled={pending}>
      {label}
    </Button>
  );
}
