'use client';

import React from 'react';
import Link from 'next/link';
import { themeTokens } from '@/app/theme/theme-config';
import { RouteMarkContextDots, RouteMarkHolds } from './route-mark-svg';

type LogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  linkToHome?: boolean;
};

const sizes = {
  sm: { icon: 32, fontSize: 14, gap: 6 },
  md: { icon: 40, fontSize: 16, gap: 8 },
  lg: { icon: 52, fontSize: 20, gap: 10 },
};

const Logo = ({ size = 'md', showText = true, linkToHome = true }: LogoProps) => {
  const { icon, fontSize, gap } = sizes[size];
  const showContext = size !== 'sm';

  const logoContent = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Boardsesh logo"
      >
        {showContext && <RouteMarkContextDots />}
        <RouteMarkHolds />
      </svg>
      {showText && (
        <span
          style={{
            fontSize,
            fontWeight: themeTokens.typography.fontWeight.extrabold,
            color: 'var(--neutral-800)',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          boardsesh
        </span>
      )}
    </div>
  );

  if (linkToHome) {
    return (
      <Link href="/" style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
        {logoContent}
      </Link>
    );
  }

  return logoContent;
};

export default Logo;
