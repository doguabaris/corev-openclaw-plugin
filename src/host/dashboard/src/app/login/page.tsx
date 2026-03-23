'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import PasswordInput from '@/components/ui/PasswordInput';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('corev_token');
    if (!token) {
      return;
    }

    fetch('http://localhost:8080/api/auth/whoami', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then(() => {
        router.replace('/dashboard/home');
      })
      .catch(() => {
        localStorage.removeItem('corev_token');
        localStorage.removeItem('corev_secret');
      });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Login failed');
        return;
      }

      const { token } = await res.json();

      const profile = await fetch('http://localhost:8080/api/auth/whoami', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const { apiSecret } = await profile.json();

      localStorage.setItem('corev_token', token);
      localStorage.setItem('corev_secret', apiSecret);

      router.push('/dashboard/home');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unexpected error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f4faff] text-[#333] px-6">
      <div className="flex flex-col items-center gap-6">
        <Image src="/corev-logo.svg" alt="Corev logo" width={180} height={64} className="mb-2" />

        <div className="w-full max-w-md bg-white border-2 border-[#333333] rounded-[30px] p-10">
          <h1 className="text-2xl font-semibold mb-2 text-center">Welcome back</h1>
          <p className="text-md text-center text-gray-600 mb-6">
            Log in with your credentials that you entered during your registration.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <TextInput
              label="E-mail"
              icon={'/email-icon.svg'}
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              borderColor="#333333"
            />
            <PasswordInput
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              borderColor="#333333"
            />

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <Button
              type="submit"
              bgColor="bg-[#AEFFDE]"
              hoverColor="hover:bg-[#92f0c6]"
              height="h-[48px]"
              icon="/arrow-right.svg"
              className="w-full justify-center"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          <p className="text-sm text-center mt-4">
            Don’t have an account?{' '}
            <a href="/register" className="text-[#00b894] font-extrabold hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
