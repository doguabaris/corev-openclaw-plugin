'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';

interface Option {
  label: string;
  value: string;
}

interface SelectBoxProps {
  options: Option[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (value: string) => void;
  fullWidth?: boolean;
  borderColor?: string;
  textColor?: string;
  placeholderColor?: string;
}

export default function SelectBox({
  options,
  placeholder = 'Add tools',
  value,
  onChange,
  onSelect,
  fullWidth = true,
  borderColor = '#e4f1ff',
  textColor = 'text-gray-700',
  placeholderColor = 'text-gray-400',
}: SelectBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const handleSelect = (val: string) => {
    onChange?.(val);
    onSelect?.(val);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`relative ${fullWidth ? 'w-full' : 'w-[200px]'} text-sm font-bold text-gray-500`}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 h-12 rounded-full bg-white cursor-pointer flex items-center justify-between transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#00b894]"
        style={{ border: `2px solid ${borderColor}` }}
      >
        <span className={value ? textColor : placeholderColor}>{selectedLabel || placeholder}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="pointer-events-none">
          <Image src="/arrow-down.svg" alt="Arrow" width={14} height={14} />
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute mt-2 w-full bg-white rounded-xl z-10 overflow-hidden"
            style={{ border: `2px solid ${borderColor}` }}
          >
            {options.map((option) => (
              <li
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className="px-4 py-2 hover:bg-[#f0f8ff] cursor-pointer transition-colors duration-150"
              >
                {option.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
