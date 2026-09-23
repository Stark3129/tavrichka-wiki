'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface SearchContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/** Провайдер состояния глобального поиска (модалка Ctrl+K). */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <SearchContext.Provider value={{ open, setOpen }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch должен использоваться внутри <SearchProvider>');
  return ctx;
}