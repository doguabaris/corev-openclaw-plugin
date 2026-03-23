'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';

export default function UserDropdown({ onLogoutAction }: { onLogoutAction: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        icon="/profile-icon.svg"
        iconAlt="User"
        iconSize={32}
        iconOnly
        height="h-12"
        bgColor="bg-[#dcfff3]"
        hoverColor="hover:bg-gray-200"
      />

      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 rounded-2xl shadow-xl bg-white border-2 border-[#ffff] z-50 overflow-hidden text-sm text-[#333]">
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#e4f1ff] to-[#dcfff3] flex items-center justify-center font-bold text-lg text-[#333]">
              N
            </div>
            <div>
              <p className="font-extrabold text-sm text-[#333]">Doğu Abaris</p>
              <p className="text-gray-500 text-xs truncate">abaris@null.net</p>
            </div>
          </div>
          <ul className="divide-y divide-[#ffff] font-semibold">
            <li>
              <a
                href="/dashboard/settings"
                className="flex items-center gap-3 px-4 py-2 hover:bg-[#e4f1ff]"
              >
                <Image src="/key-icon.svg" alt="My Account" width={18} height={18} />
                My Account
              </a>
            </li>
            <li>
              <a
                href="/dashboard/support"
                className="flex items-center gap-3 px-4 py-2 hover:bg-[#e4f1ff]"
              >
                <Image src="/help-icon.svg" alt="Support" width={18} height={18} />
                Support
              </a>
            </li>
            <li className="border-t-1 border-gray-200">
              <button
                onClick={onLogoutAction}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-[#e4f1ff]"
              >
                <Image src="/logout-icon.svg" alt="Logout" width={18} height={18} />
                Log Out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
