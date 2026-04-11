import React from 'react';

export default function LogbookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100dvh', paddingTop: 'var(--global-header-height)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {children}
    </div>
  );
}
