import { ReactNode } from 'react';
import Image from 'next/image';
import clsx from 'clsx';

interface ButtonProps {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  onFocus?: () => void;
  type?: 'button' | 'submit' | 'reset';
  bgColor?: string;
  hoverColor?: string;
  height?: string;
  icon?: string;
  iconPosition?: 'left' | 'right';
  iconAlt?: string;
  iconSize?: number;
  iconWidth?: number;
  iconHeight?: number;
  iconOnly?: boolean;
  hideBorder?: boolean;
  as?: 'a' | 'button';
  href?: string;
  target?: string;
  rel?: string;
  disabled?: boolean;
}

export default function Button({
  children,
  className = '',
  onClick,
  type = 'button',
  bgColor = 'bg-[#FFFFFF]',
  hoverColor = 'hover:bg-[#B6F4C7]',
  height = 'h-auto',
  icon,
  iconPosition = 'right',
  iconAlt = 'Icon',
  iconSize = 16,
  iconWidth,
  iconHeight,
  iconOnly = false,
  hideBorder = false,
  as = 'button',
  href,
  target,
  rel,
  disabled = false,
}: ButtonProps) {
  const iconW = iconWidth || iconSize;
  const iconH = iconHeight || iconSize;

  const commonClasses = clsx(
    'inline-flex items-center justify-center gap-2 rounded-full text-sm font-bold text-[#333333] transition-colors cursor-pointer',
    iconOnly ? 'p-2 w-[42px] h-[42px]' : 'px-5 py-2',
    !hideBorder && 'border-2 border-[#333333]',
    bgColor,
    hoverColor,
    height,
    className,
  );

  const iconLeft = icon && iconPosition === 'left' && (
    <Image src={icon} alt={iconAlt} width={iconW} height={iconH} />
  );

  const iconRight = icon && iconPosition === 'right' && (
    <Image src={icon} alt={iconAlt} width={iconW} height={iconH} />
  );

  if (as === 'a' && href) {
    return (
      <a href={href} target={target} rel={rel} className={commonClasses}>
        {iconLeft}
        {!iconOnly && children}
        {iconRight}
      </a>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={commonClasses}>
      {iconLeft}
      {!iconOnly && children}
      {iconRight}
    </button>
  );
}
