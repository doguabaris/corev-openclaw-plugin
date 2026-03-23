'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('corev_token');
    if (token) {
      router.replace('/dashboard/home');
    } else {
      router.replace('/login');
    }
    setChecked(true);
  }, [router]);

  return checked ? null : <div>Redirecting...</div>;
}
