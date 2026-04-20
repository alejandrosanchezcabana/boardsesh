import { useCallback } from 'react';
import confetti from 'canvas-confetti';

export type ConfettiVariant = 'ascent' | 'attempt' | 'flash';

/**
 * Fires short electric arcs radiating outward from the target element's
 * center. The overlay is appended to document.body so it's independent of
 * React's render tree and survives component unmounts.
 */
function fireThunderstrike(targetElement: HTMLElement) {
  const rect = targetElement.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 1500;
    pointer-events: none;
  `;

  // Generate 5 short jagged arcs that crawl outward from the button edge
  // like snakes — the head leads and the tail follows behind.
  const arcCount = 5;
  const buttonRadius = Math.max(rect.width, rect.height) / 2;
  let paths = '';
  for (let i = 0; i < arcCount; i++) {
    const angle = (i / arcCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const length = 45 + Math.random() * 35;
    // Start from the button edge
    const startDist = buttonRadius + 2 + Math.random() * 4;
    const startX = cx + Math.cos(angle) * startDist;
    const startY = cy + Math.sin(angle) * startDist;
    let d = `M ${startX.toFixed(1)} ${startY.toFixed(1)}`;
    const segments = 4;
    for (let s = 1; s <= segments; s++) {
      const progress = s / segments;
      const jitter = (Math.random() - 0.5) * 14;
      const px = startX + Math.cos(angle) * length * progress + Math.sin(angle) * jitter;
      const py = startY + Math.sin(angle) * length * progress - Math.cos(angle) * jitter;
      d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
    }
    const delay = (Math.random() * 0.05).toFixed(3);
    // Use stroke-dasharray to create a short visible segment that travels
    // along the path (snake-like: head moves forward, tail follows).
    const segLen = Math.round(length * 0.4);
    const totalLen = Math.round(length * 1.2);
    paths += `
      <path d="${d}" fill="none" stroke="#FFC107" stroke-width="2.5"
            filter="url(#arc-glow)"
            stroke-dasharray="${segLen} ${totalLen}"
            stroke-dashoffset="${segLen}"
            style="animation: arc-crawl 0.25s ${delay}s ease-out forwards"/>
      <path d="${d}" fill="none" stroke="white" stroke-width="1"
            stroke-dasharray="${segLen} ${totalLen}"
            stroke-dashoffset="${segLen}"
            style="animation: arc-crawl 0.25s ${delay}s ease-out forwards"/>`;
  }

  overlay.innerHTML = `
    <svg width="100%" height="100%" style="position:absolute;inset:0">
      <defs>
        <filter id="arc-glow">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      ${paths}
    </svg>
    <style>
      @keyframes arc-crawl {
        0% { stroke-dashoffset: ${Math.round(45 * 0.4)}; opacity: 1; }
        70% { opacity: 0.8; }
        100% { stroke-dashoffset: -${Math.round(80 * 1.2)}; opacity: 0; }
      }
    </style>
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 300);

  // Pulse the button itself (expand then contract)
  targetElement.animate?.([
    { transform: 'scale(1)' },
    { transform: 'scale(1.3)' },
    { transform: 'scale(1)' },
  ], { duration: 250, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
}

/**
 * Returns a function that fires a celebration animation.
 * Pass an HTMLElement to anchor the burst origin to that element,
 * otherwise it bursts from the bottom-center of the viewport.
 *
 * Variant controls the style:
 * - 'ascent' (default): multi-colour celebratory confetti burst
 * - 'attempt': red-only confetti, shorter range
 * - 'flash': lightning bolt strikes down to the origin element
 */
export function useConfetti() {
  const fireConfetti = useCallback((originElement?: HTMLElement | null, variant: ConfettiVariant = 'ascent') => {
    // Flash: fire a lightning bolt striking the button
    if (variant === 'flash') {
      if (originElement) {
        fireThunderstrike(originElement);
      }
      return;
    }

    let x = 0.5;
    let y = 0.9;

    if (originElement) {
      const rect = originElement.getBoundingClientRect();
      x = (rect.left + rect.width / 2) / window.innerWidth;
      y = (rect.top + rect.height / 2) / window.innerHeight;
    }

    const isAttempt = variant === 'attempt';

    confetti({
      particleCount: 35,
      spread: isAttempt ? 40 : 60,
      startVelocity: isAttempt ? 12 : 25,
      decay: 0.92,
      scalar: 0.8,
      ticks: 60,
      origin: { x, y },
      gravity: 0.8,
      disableForReducedMotion: true,
      // Must be above MUI drawer z-index (1300) so confetti is visible
      // when fired from inside a SwipeableDrawer portal.
      zIndex: 1400,
      ...(isAttempt && { colors: ['#d32f2f', '#b71c1c', '#e53935'] }),
    });
  }, []);

  return fireConfetti;
}
