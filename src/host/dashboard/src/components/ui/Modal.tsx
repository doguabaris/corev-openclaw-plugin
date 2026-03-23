'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '@/components/ui/Button';

interface ModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  children: ReactNode;
  title: string;
}

export default function Modal({ isOpen, onCloseAction, children, title }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onCloseAction();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onCloseAction]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            ref={modalRef}
            className="bg-white border-2 border-[#333333] rounded-[30px] p-8 max-w-lg w-full relative"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#333]">{title}</h2>
              <Button
                onClick={onCloseAction}
                icon="/close-icon.svg"
                iconAlt="Close"
                iconOnly
                height="h-[30px]"
                className=""
                bgColor="bg-[#dcfff3]"
                hoverColor="hover:bg-gray-200"
                hideBorder
              />
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
