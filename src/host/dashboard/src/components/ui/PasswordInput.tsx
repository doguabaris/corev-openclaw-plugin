'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import TextInput from './TextInput';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  borderColor?: string;
}

export default function PasswordInput({
  borderColor = '#e4f1ff',
  className = '',
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <TextInput
        icon={'/password-icon.svg'}
        label="Password"
        {...props}
        type={showPassword ? 'text' : 'password'}
        borderColor={borderColor}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute cursor-pointer top-1/2 right-3 transform -translate-y-1/2 text-gray-500 hover:text-[#00b894]"
        tabIndex={-1}
      >
        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}
