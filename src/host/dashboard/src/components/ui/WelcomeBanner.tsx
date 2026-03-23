'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Props {
  email: string;
}

export default function WelcomeBanner({ email }: Props) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleString());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center mb-14 gap-5">
      <div className="flex-shrink-0">
        <div className="w-14 h-14 rounded-full bg-[#000] flex items-center justify-center">
          <Image src="/cli-icon.svg" alt="User" width={28} height={28} />
        </div>
      </div>
      <div className="flex flex-col justify-center font-extrabold">
        <h2 className="text-3xl font-bold text-[#333]">
          Welcome back, <span className="text-[#00b894]">{email}</span>
        </h2>
        {time && <p className="text-sm text-gray-600 mt-1">{time}</p>}
      </div>
    </div>
  );
}
