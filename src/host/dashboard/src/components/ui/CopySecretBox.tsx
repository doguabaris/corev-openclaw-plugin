'use client';

import { useEffect, useState } from 'react';
import Button from './Button';

export default function CopySecretBox() {
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('corev_secret');
    if (stored) {
      setSecret(stored);
    }

    const timeout = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className={`flex items-center justify-between mb-16 border-2 border-[#333333] bg-white px-6 py-[14px] rounded-full w-full  h-[65px] transition-all duration-700 ease-out transform ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[#00b894] font-extrabold">YOUR API SECRET KEY:</span>
        <code className="text-[16px] font-medium text-[#333333] truncate max-w-[280px] sm:max-w-[340px]">
          {secret || 'No secret found'}
        </code>
      </div>
      <div className="relative group">
        <Button
          onClick={handleCopy}
          icon={copied ? '/check-icon.svg' : '/copy-icon.svg'}
          iconAlt={copied ? 'Copied!' : 'Copy'}
          iconOnly
          iconSize={24}
          hideBorder
          bgColor="bg-transparent"
          hoverColor="hover:bg-gray-100"
        />
        <span className="absolute -top-8 right-1 text-xs px-2 py-1 bg-[#333333] text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </div>
    </div>
  );
}
