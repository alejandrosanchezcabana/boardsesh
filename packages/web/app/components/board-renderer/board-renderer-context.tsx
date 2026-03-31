'use client';

import { createContext, useContext } from 'react';

const RustRendererContext = createContext(false);

export const RustRendererProvider = RustRendererContext.Provider;
export const useRustRenderer = () => useContext(RustRendererContext);
