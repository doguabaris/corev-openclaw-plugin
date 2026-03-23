'use client';

import React from 'react';
import Image from 'next/image';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: React.ReactNode;
  helpText?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
  borderColor?: string;
  icon?: string;
  iconAlt?: string;
}

export default function TextInput({
  label,
  description,
  helpText,
  className = '',
  fullWidth = true,
  borderColor = '#e4f1ff',
  id,
  icon,
  iconAlt = 'icon',
  ...props
}: TextInputProps) {
  return (
    <div className={`${fullWidth ? 'w-full' : ''} space-y-1`}>
      {description && <p className="text-sm text-gray-500 leading-snug ml-1 mb-4">{description}</p>}

      <div className="relative">
        {label && (
          <label
            htmlFor={id}
            className="absolute -top-2 left-5 bg-white px-2 text-xs text-gray-600 z-10 font-extrabold"
          >
            {label}
          </label>
        )}

        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Image src={icon} alt={iconAlt} width={20} height={20} />
          </div>
        )}

        <input
          id={id}
          {...props}
          className={`
                        w-full
                        ${icon ? 'pl-12' : 'pl-4'}
                        pr-4 py-2
                        border-2
                        rounded-full bg-white
                        text-sm text-[#333333]
                        h-12
                        font-bold
                        placeholder-gray-500
                        focus:outline-none focus:ring-2 focus:ring-[#00b894]
                        transition-all duration-200
                        ${className}
                    `}
          style={{ borderColor }}
        />
      </div>

      {helpText && <p className="text-xs text-gray-400 ml-1">{helpText}</p>}
    </div>
  );
}
