'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Button from '@/components/ui/Button';
import TextInput from '@/components/ui/TextInput';
import Modal from '@/components/ui/Modal';
import UserDropdown from '@/components/ui/UserDropdown';

interface MenuItem {
  label: string;
  href: string;
  icon: string;
  external?: boolean;
  section: 'MENU' | 'GENERAL';
  onClick?: () => void;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('corev_token');
    if (!token) {
      return router.push('/login');
    }

    fetch('http://localhost:8080/api/auth/whoami', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .catch(() => router.push('/login'));
  }, [router]);

  const logout = () => {
    localStorage.removeItem('corev_token');
    localStorage.removeItem('corev_secret');
    router.push('/login');
  };

  const menuItems: MenuItem[] = [
    { label: 'Dashboard', href: '/dashboard/home', icon: '/dashboard-icon.svg', section: 'MENU' },
    { label: 'Projects', href: '/dashboard/projects', icon: '/source-icon.svg', section: 'MENU' },
    {
      label: 'Docs',
      href: 'https://doguabaris.github.io/corev-cli-docs/',
      icon: '/docs-icon.svg',
      external: true,
      section: 'MENU',
    },
    {
      label: 'Help',
      href: 'https://doguabaris.github.io/corev-cli-docs/',
      icon: '/help-icon.svg',
      section: 'GENERAL',
      external: true,
    },
    {
      label: 'Logout',
      href: '#',
      icon: '/logout-icon.svg',
      section: 'GENERAL',
      onClick: logout,
    },
  ];

  const renderSection = (sectionName: 'MENU' | 'GENERAL') => (
    <div className="mt-10 space-y-4">
      <h3 className="text-md font-semibold text-gray-400 tracking-wide mb-2 px-2">{sectionName}</h3>
      <nav className="flex flex-col gap-3 text-[18px] font-medium text-[#333]">
        {menuItems
          .filter((item) => item.section === sectionName)
          .map((item, index) =>
            item.external ? (
              <a
                key={index}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-[#e4f1ff] transition"
              >
                <Image src={item.icon} alt={item.label} width={20} height={20} />
                {item.label}
              </a>
            ) : item.onClick ? (
              <button
                key={index}
                onClick={item.onClick}
                className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-[#e4f1ff] transition"
              >
                <Image src={item.icon} alt={item.label} width={20} height={20} />
                {item.label}
              </button>
            ) : (
              <a
                key={index}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-[#e4f1ff] transition"
              >
                <Image src={item.icon} alt={item.label} width={20} height={20} />
                {item.label}
              </a>
            ),
          )}
      </nav>
    </div>
  );

  const renderDonationCard = () => (
    <div className="mt-10 p-4 bg-[#fff] border-2 border-[#B6F4C7] rounded-xl flex flex-col items-start gap-4">
      <div className="flex items-center gap-3">
        <div className="min-w-[56px] min-h-[56px] bg-[#dcfff3] rounded-full flex items-center justify-center">
          <Image src="/heart-icon.svg" alt="Heart" width={32} height={32} />
        </div>
        <p className="text-[14px] font-medium leading-snug">
          Corev Host is a free service. To keep it that way, we kindly ask for your support through
          donations.
        </p>
      </div>
      <Button
        icon="/arrow-right.svg"
        iconSize={20}
        iconAlt="Donate"
        onClick={() => window.open('https://github.com/sponsors/doguabaris', '_blank')}
        bgColor="bg-[#fff]"
        hoverColor="hover:bg-[#B6F4C7]"
        height="h-[38px]"
      >
        Sponsor
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4faff] text-[#333] font-sans">
      <header className="mx-auto mt-0 md:mt-[20px] max-w-11/12 h-[83px] px-6 flex justify-between items-center">
        <Image src="/corev-logo.svg" alt="Corev" width={180} height={32} priority />
        <div className="flex items-center gap-4">
          <Button
            onClick={() => setIsSearchOpen(true)}
            icon="/search-icon-black.svg"
            iconAlt="Profile"
            iconSize={32}
            iconOnly
            height="h-12"
            className=""
            bgColor="bg-[#dcfff3]"
            hoverColor="hover:bg-gray-200"
          />
          <UserDropdown onLogoutAction={logout} />
        </div>
      </header>
      <Modal isOpen={isSearchOpen} onCloseAction={() => setIsSearchOpen(false)} title="Search">
        <TextInput
          id="search"
          placeholder="Search"
          icon="/search-icon-black.svg"
          autoFocus
          borderColor="#333333"
          fullWidth
        />
      </Modal>

      <div className="mx-auto mt-0 md:mt-[20px] max-w-11/12 px-6 flex justify-between items-start">
        <aside className="w-[300px] hidden md:block">
          {renderSection('MENU')}
          {renderSection('GENERAL')}
          {renderDonationCard()}
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
