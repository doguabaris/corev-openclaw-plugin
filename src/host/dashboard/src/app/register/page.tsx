'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import PasswordInput from '@/components/ui/PasswordInput';
import Image from 'next/image';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8080/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Registration failed');
        return;
      }

      router.push('/login');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unexpected error occurred');
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
          <h1 className="text-2xl font-semibold mb-2 text-center">Create your Corev account</h1>
          <p className="text-md text-center text-gray-600 mb-6">
            Start managing your configurations with a single account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <TextInput
              icon={'/email-icon.svg'}
              label="E-mail"
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
              {loading ? 'Creating...' : 'Sign Up'}
            </Button>
          </form>

          <p className="text-sm text-center mt-4">
            Already have an account?{' '}
            <a href="/login" className="text-[#00b894] font-extrabold hover:underline">
              Log in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
