import React, { createContext, useContext, useState } from 'react';

export type PageId = 'home' | 'search' | 'settings';

interface NavigationContextValue {
  currentPage: PageId;
  navigateTo: (page: PageId) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<PageId>('search');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const navigateTo = (page: PageId) => {
    setCurrentPage(page);
  };

  return (
    <NavigationContext.Provider
      value={{
        currentPage,
        navigateTo,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextValue => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation harus digunakan di dalam NavigationProvider');
  }
  return context;
};
