'use client';

import React from 'react';
import Link from 'next/link';

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

// Route mark colors
const HOLD_GREY = '#7a7a7e';
const CONTEXT_GREY = '#4a4a52';
const PURPLE = '#c44a8a';
const CYAN = '#3fb8c4';
const GREEN = '#5fb27a';
const ORANGE = '#e2a44d';

/** Context dots -- subtle background holds that add texture at larger sizes */
const ContextDots = () => (
  <>
    <ellipse cx="10" cy="12" rx="3.6" ry="2.4" fill={CONTEXT_GREY} transform="rotate(-10 10 12)" />
    <ellipse cx="52" cy="16" rx="3.6" ry="2.4" fill={CONTEXT_GREY} transform="rotate(20 52 16)" />
    <ellipse cx="14" cy="50" rx="3.6" ry="2.4" fill={CONTEXT_GREY} transform="rotate(25 14 50)" />
    <ellipse cx="54" cy="50" rx="3.6" ry="2.4" fill={CONTEXT_GREY} transform="rotate(-15 54 50)" />
    <ellipse cx="32" cy="32" rx="3.2" ry="2.2" fill={CONTEXT_GREY} transform="rotate(5 32 32)" />
    <ellipse cx="22" cy="28" rx="3" ry="2" fill={CONTEXT_GREY} transform="rotate(-25 22 28)" />
    <ellipse cx="44" cy="36" rx="3" ry="2" fill={CONTEXT_GREY} transform="rotate(14 44 36)" />
  </>
);

/** The 4 climbing holds (start, hand, foot, finish) arranged in a diamond */
const Holds = () => (
  <>
    {/* Start hold -- purple */}
    <ellipse cx="28" cy="10" rx="4" ry="2.8" fill={HOLD_GREY} transform="rotate(-8 28 10)" />
    <circle cx="28" cy="10" r="9" fill="none" stroke={PURPLE} strokeWidth="2" />

    {/* Hand hold -- cyan */}
    <ellipse cx="46" cy="26" rx="4" ry="2.8" fill={HOLD_GREY} transform="rotate(18 46 26)" />
    <circle cx="46" cy="26" r="9" fill="none" stroke={CYAN} strokeWidth="2" />

    {/* Foot hold -- green */}
    <ellipse cx="18" cy="38" rx="3.6" ry="2.6" fill={HOLD_GREY} transform="rotate(-22 18 38)" />
    <circle cx="18" cy="38" r="9" fill="none" stroke={GREEN} strokeWidth="2" />

    {/* Finish hold -- orange */}
    <ellipse cx="32" cy="54" rx="4" ry="2.8" fill={HOLD_GREY} transform="rotate(5 32 54)" />
    <circle cx="32" cy="54" r="9" fill="none" stroke={ORANGE} strokeWidth="2" />
  </>
);

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
        {showContext && <ContextDots />}
        <Holds />
      </svg>
      {showText && (
        <span
          style={{
            fontSize,
            fontWeight: 800,
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
