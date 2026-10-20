'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api';
import { safeNextPath } from '@/lib/safe-redirect';
import { PasswordStrength } from '@/components/password-strength';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AuthResponse {
  user: { id: string; name: string; role: string };
  business: { id: string; name: string };
}

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessNameZh, setBusinessNameZh] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }
    setPending(true);
    try {
      await api<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          businessName,
          businessNameZh: businessNameZh || undefined,
          email,
          password,
          confirmPassword
        })
      });
      router.push(safeNextPath(searchParams.get('next')));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? t('toLogin') : t('genericError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{t('registerTitle')}</CardTitle>
        <CardDescription>{t('registerSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t('name')}</Label>
            <Input id="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessName">{t('businessName')}</Label>
            <Input
              id="businessName"
              required
              maxLength={120}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessNameZh">{t('businessNameZh')}</Label>
            <Input
              id="businessNameZh"
              maxLength={120}
              value={businessNameZh}
              onChange={(e) => setBusinessNameZh(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
            />
            <p id="password-hint" className="text-xs text-muted-foreground">
              {t('passwordHint')}
            </p>
            <PasswordStrength value={password} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={confirmPassword.length > 0 && confirmPassword !== password ? true : undefined}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t('working') : t('submitRegister')}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            {t('toLogin')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
