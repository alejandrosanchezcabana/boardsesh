'use client';

import { createContext, useContext, ReactNode } from 'react';

const RustRendererContext = createContext(false);

export const RustRendererProvider = ({ value, children }: { value: boolean; children: ReactNode }) => (
  <RustRendererContext.Provider value={value}>{children}</RustRendererContext.Provider>
);

export const useRustRenderer = () => useContext(RustRendererContext);
