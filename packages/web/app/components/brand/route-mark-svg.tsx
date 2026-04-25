import { themeTokens } from '@/app/theme/theme-config';

const { holdGrey, contextGrey, purple, cyan, green, orange } = themeTokens.routeMark;

export function RouteMarkContextDots() {
  return (
    <>
      <ellipse cx="10" cy="12" rx="3.6" ry="2.4" fill={contextGrey} transform="rotate(-10 10 12)" />
      <ellipse cx="52" cy="16" rx="3.6" ry="2.4" fill={contextGrey} transform="rotate(20 52 16)" />
      <ellipse cx="14" cy="50" rx="3.6" ry="2.4" fill={contextGrey} transform="rotate(25 14 50)" />
      <ellipse cx="54" cy="50" rx="3.6" ry="2.4" fill={contextGrey} transform="rotate(-15 54 50)" />
      <ellipse cx="32" cy="32" rx="3.2" ry="2.2" fill={contextGrey} transform="rotate(5 32 32)" />
      <ellipse cx="22" cy="28" rx="3" ry="2" fill={contextGrey} transform="rotate(-25 22 28)" />
      <ellipse cx="44" cy="36" rx="3" ry="2" fill={contextGrey} transform="rotate(14 44 36)" />
    </>
  );
}

export function RouteMarkHolds() {
  return (
    <>
      {/* Start hold -- purple */}
      <ellipse cx="28" cy="10" rx="4" ry="2.8" fill={holdGrey} transform="rotate(-8 28 10)" />
      <circle cx="28" cy="10" r="9" fill="none" stroke={purple} strokeWidth="2" />

      {/* Hand hold -- cyan */}
      <ellipse cx="46" cy="26" rx="4" ry="2.8" fill={holdGrey} transform="rotate(18 46 26)" />
      <circle cx="46" cy="26" r="9" fill="none" stroke={cyan} strokeWidth="2" />

      {/* Foot hold -- green */}
      <ellipse cx="18" cy="38" rx="3.6" ry="2.6" fill={holdGrey} transform="rotate(-22 18 38)" />
      <circle cx="18" cy="38" r="9" fill="none" stroke={green} strokeWidth="2" />

      {/* Finish hold -- orange */}
      <ellipse cx="32" cy="54" rx="4" ry="2.8" fill={holdGrey} transform="rotate(5 32 54)" />
      <circle cx="32" cy="54" r="9" fill="none" stroke={orange} strokeWidth="2" />
    </>
  );
}
