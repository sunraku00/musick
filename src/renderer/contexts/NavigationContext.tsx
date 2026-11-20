import React, { createContext, useContext, useState } from 'react';

export type PageId = 'home' | 'search' | 'settings' | 'artist' | 'album';

interface NavigationContextValue {
  currentPage: PageId;
  navigateTo: (page: PageId) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedArtistId: string | null;
  selectedAlbumId: string | null;
  navigateToArtist: (artistId: string) => void;
  navigateToAlbum: (albumId: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<PageId>('search');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  const navigateTo = (page: PageId) => {
    setCurrentPage(page);
  };

  const navigateToArtist = (artistId: string) => {
    setSelectedArtistId(artistId);
    setCurrentPage('artist');
  };

  const navigateToAlbum = (albumId: string) => {
    setSelectedAlbumId(albumId);
    setCurrentPage('album');
  };

  return (
    <NavigationContext.Provider
      value={{
        currentPage,
        navigateTo,
        searchQuery,
        setSearchQuery,
        selectedArtistId,
        selectedAlbumId,
        navigateToArtist,
        navigateToAlbum,
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
