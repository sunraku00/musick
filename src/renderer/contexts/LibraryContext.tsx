import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { LibraryChangeEvent } from '../../shared/ipc';
import type { Playlist, PlaylistDetails, PlaylistTrackItem, Track } from '../../shared/types';

interface LibraryContextValue {
  likedTrackIds: Set<string>;
  likedTracks: Track[];
  playlists: Playlist[];
  activePlaylist: PlaylistDetails | null;
  isLoading: boolean;
  isLiked: (trackId: string) => boolean;
  toggleLike: (track: Track) => Promise<boolean>;
  createPlaylist: (name: string, description?: string) => Promise<Playlist>;
  renamePlaylist: (playlistId: number, newName: string) => Promise<void>;
  deletePlaylist: (playlistId: number) => Promise<void>;
  addTrackToPlaylist: (playlistId: number, track: Track) => Promise<{ added: boolean; isDuplicate: boolean; playlistTrackId: number }>;
  removeTrackFromPlaylist: (playlistId: number, playlistTrackId: number) => Promise<void>;
  reorderPlaylistTracks: (playlistId: number, trackIdsInOrder: number[]) => Promise<void>;
  loadActivePlaylist: (playlistId: number) => Promise<PlaylistDetails | null>;
  refreshPlaylists: () => Promise<void>;
  refreshLikedTracks: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<PlaylistDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refs untuk pemulihan optimistik (rollback) jika DB gagal
  const likedTrackIdsRef = useRef(likedTrackIds);
  likedTrackIdsRef.current = likedTrackIds;
  const likedTracksRef = useRef(likedTracks);
  likedTracksRef.current = likedTracks;
  const playlistsRef = useRef(playlists);
  playlistsRef.current = playlists;
  const activePlaylistRef = useRef(activePlaylist);
  activePlaylistRef.current = activePlaylist;

  const normalizeId = (id: string): string => {
    return id.startsWith('ytmusic:') ? id : `ytmusic:${id}`;
  };

  const isLiked = useCallback(
    (trackId: string): boolean => {
      if (!trackId) return false;
      const norm = normalizeId(trackId);
      const raw = trackId.replace(/^ytmusic:/, '');
      return likedTrackIds.has(norm) || likedTrackIds.has(raw);
    },
    [likedTrackIds]
  );

  const refreshLikedTracks = useCallback(async () => {
    if (!window.musicApi) return;
    try {
      const list = await window.musicApi.dbGetLikedTracks();
      const safeList = list || [];
      setLikedTracks(safeList);
      const idSet = new Set<string>();
      for (const t of safeList) {
        idSet.add(normalizeId(t.id));
        idSet.add(t.id.replace(/^ytmusic:/, ''));
      }
      setLikedTrackIds(idSet);
    } catch (err) {
      console.error('[LibraryContext] Gagal memuat lagu disukai:', err);
    }
  }, []);

  const refreshPlaylists = useCallback(async () => {
    if (!window.musicApi) return;
    try {
      const list = await window.musicApi.dbGetPlaylists();
      setPlaylists(list || []);
    } catch (err) {
      console.error('[LibraryContext] Gagal memuat daftar playlist:', err);
    }
  }, []);

  const loadActivePlaylist = useCallback(async (playlistId: number): Promise<PlaylistDetails | null> => {
    if (!window.musicApi || !playlistId) return null;
    try {
      const data = await window.musicApi.dbGetPlaylist(playlistId);
      setActivePlaylist(data);
      return data;
    } catch (err) {
      console.error('[LibraryContext] Gagal memuat active playlist:', err);
      return null;
    }
  }, []);

  // Inisialisasi awal & langganan event IPC library:changed dari main process
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setIsLoading(true);
      await Promise.all([refreshLikedTracks(), refreshPlaylists()]);
      if (mounted) setIsLoading(false);
    };
    init();

    if (window.musicApi?.onLibraryChanged) {
      const unsubscribe = window.musicApi.onLibraryChanged((event: LibraryChangeEvent) => {
        if (!mounted) return;
        switch (event.type) {
          case 'like': {
            const norm = normalizeId(event.trackId);
            const raw = event.trackId.replace(/^ytmusic:/, '');
            setLikedTrackIds((prev) => {
              const next = new Set(prev);
              if (event.isLiked) {
                next.add(norm);
                next.add(raw);
              } else {
                next.delete(norm);
                next.delete(raw);
              }
              return next;
            });
            if (event.isLiked && event.track) {
              setLikedTracks((prev) => {
                if (prev.some((t) => t.id === event.track!.id)) return prev;
                return [event.track!, ...prev];
              });
            } else if (!event.isLiked) {
              setLikedTracks((prev) => prev.filter((t) => t.id !== norm && t.id !== raw));
            }
            break;
          }
          case 'playlist_created': {
            setPlaylists((prev) => {
              if (prev.some((p) => p.id === event.playlist.id)) return prev;
              return [event.playlist, ...prev];
            });
            break;
          }
          case 'playlist_renamed': {
            setPlaylists((prev) =>
              prev.map((p) => (p.id === event.playlistId ? { ...p, name: event.name } : p))
            );
            setActivePlaylist((prev) => (prev && prev.id === event.playlistId ? { ...prev, name: event.name } : prev));
            break;
          }
          case 'playlist_deleted': {
            setPlaylists((prev) => prev.filter((p) => p.id !== event.playlistId));
            setActivePlaylist((prev) => (prev && prev.id === event.playlistId ? null : prev));
            break;
          }
          case 'playlist_tracks_changed': {
            refreshPlaylists();
            if (activePlaylistRef.current && activePlaylistRef.current.id === event.playlistId) {
              loadActivePlaylist(event.playlistId);
            }
            break;
          }
        }
      });
      return () => {
        mounted = false;
        unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, [refreshLikedTracks, refreshPlaylists, loadActivePlaylist]);

  // Aksi-aksi optimistik dengan rollback otomatis jika DB melempar error
  const toggleLike = useCallback(
    async (track: Track): Promise<boolean> => {
      if (!window.musicApi) return false;
      const norm = normalizeId(track.id);
      const raw = track.id.replace(/^ytmusic:/, '');
      const prevIds = likedTrackIdsRef.current;
      const prevTracks = likedTracksRef.current;
      const currentlyLiked = prevIds.has(norm) || prevIds.has(raw);
      const targetLiked = !currentlyLiked;

      // 1. Pembaruan optimistik seketika (< 10 ms)
      setLikedTrackIds((prev) => {
        const next = new Set(prev);
        if (targetLiked) {
          next.add(norm);
          next.add(raw);
        } else {
          next.delete(norm);
          next.delete(raw);
        }
        return next;
      });

      if (targetLiked) {
        setLikedTracks((prev) => [track, ...prev.filter((t) => t.id !== norm && t.id !== raw)]);
      } else {
        setLikedTracks((prev) => prev.filter((t) => t.id !== norm && t.id !== raw));
      }

      // 2. Persistensi ke Database
      try {
        const actualLiked = await window.musicApi.dbToggleLikeTrack(track);
        if (actualLiked !== targetLiked) {
          // Sinkronisasi ulang jika nilai aktual DB berbeda
          await refreshLikedTracks();
        }
        return actualLiked;
      } catch (err) {
        // Rollback ke state sebelumnya jika terjadi kegagalan DB
        console.error('[LibraryContext] Rollback toggleLike karena error DB:', err);
        setLikedTrackIds(prevIds);
        setLikedTracks(prevTracks);
        throw err;
      }
    },
    [refreshLikedTracks]
  );

  const createPlaylist = useCallback(
    async (name: string, description?: string): Promise<Playlist> => {
      if (!window.musicApi) throw new Error('musicApi tidak tersedia');
      const cleanName = (name || '').trim().slice(0, 100);
      const cleanDesc = (description || '').trim().slice(0, 300);

      const created = await window.musicApi.dbCreatePlaylist(cleanName, cleanDesc);
      setPlaylists((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      return created;
    },
    []
  );

  const renamePlaylist = useCallback(
    async (playlistId: number, newName: string): Promise<void> => {
      if (!window.musicApi) return;
      const prevPlaylists = playlistsRef.current;
      const prevActive = activePlaylistRef.current;
      const cleanName = (newName || '').trim().slice(0, 100);

      // Optimistik
      setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? { ...p, name: cleanName } : p)));
      if (prevActive && prevActive.id === playlistId) {
        setActivePlaylist({ ...prevActive, name: cleanName });
      }

      try {
        await window.musicApi.dbRenamePlaylist(playlistId, cleanName);
      } catch (err) {
        setPlaylists(prevPlaylists);
        setActivePlaylist(prevActive);
        throw err;
      }
    },
    []
  );

  const deletePlaylist = useCallback(
    async (playlistId: number): Promise<void> => {
      if (!window.musicApi) return;
      const prevPlaylists = playlistsRef.current;
      const prevActive = activePlaylistRef.current;

      // Optimistik
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      if (prevActive && prevActive.id === playlistId) {
        setActivePlaylist(null);
      }

      try {
        await window.musicApi.dbDeletePlaylist(playlistId);
      } catch (err) {
        setPlaylists(prevPlaylists);
        setActivePlaylist(prevActive);
        throw err;
      }
    },
    []
  );

  const addTrackToPlaylist = useCallback(
    async (playlistId: number, track: Track) => {
      if (!window.musicApi) throw new Error('musicApi tidak tersedia');

      const res = await window.musicApi.dbAddTrackToPlaylist(playlistId, track);

      // Perbarui trackCount pada playlist di daftar sidebar
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, trackCount: p.trackCount + 1 } : p))
      );

      // Jika playlist yang sedang dibuka adalah playlist target, tambahkan ke activePlaylist
      setActivePlaylist((prev) => {
        if (!prev || prev.id !== playlistId) return prev;
        const newItem: PlaylistTrackItem = {
          ...track,
          playlistTrackId: res.playlistTrackId,
          position: (prev.tracks.length || 0) + 1,
          addedAt: new Date().toISOString(),
        };
        return {
          ...prev,
          trackCount: prev.trackCount + 1,
          tracks: [...prev.tracks, newItem],
        };
      });

      return res;
    },
    []
  );

  const removeTrackFromPlaylist = useCallback(
    async (playlistId: number, playlistTrackId: number): Promise<void> => {
      if (!window.musicApi) return;
      const prevActive = activePlaylistRef.current;

      // Optimistik: hapus dari activePlaylist dan kurangi trackCount di daftar playlists
      setActivePlaylist((prev) => {
        if (!prev || prev.id !== playlistId) return prev;
        const updatedTracks = prev.tracks
          .filter((t) => t.playlistTrackId !== playlistTrackId)
          .map((t, idx) => ({ ...t, position: idx + 1 }));
        return {
          ...prev,
          trackCount: Math.max(0, prev.trackCount - 1),
          tracks: updatedTracks,
        };
      });

      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, trackCount: Math.max(0, p.trackCount - 1) } : p))
      );

      try {
        await window.musicApi.dbRemoveTrackFromPlaylist(playlistTrackId);
      } catch (err) {
        setActivePlaylist(prevActive);
        await refreshPlaylists();
        throw err;
      }
    },
    [refreshPlaylists]
  );

  const reorderPlaylistTracks = useCallback(
    async (playlistId: number, trackIdsInOrder: number[]): Promise<void> => {
      if (!window.musicApi) return;
      const prevActive = activePlaylistRef.current;

      // Optimistik
      setActivePlaylist((prev) => {
        if (!prev || prev.id !== playlistId) return prev;
        const trackMap = new Map(prev.tracks.map((t) => [t.playlistTrackId, t]));
        const reordered: PlaylistTrackItem[] = [];
        for (let i = 0; i < trackIdsInOrder.length; i++) {
          const item = trackMap.get(trackIdsInOrder[i]);
          if (item) {
            reordered.push({ ...item, position: i + 1 });
          }
        }
        return {
          ...prev,
          tracks: reordered,
        };
      });

      try {
        await window.musicApi.dbReorderPlaylistTracks(playlistId, trackIdsInOrder);
      } catch (err) {
        setActivePlaylist(prevActive);
        throw err;
      }
    },
    []
  );

  return (
    <LibraryContext.Provider
      value={{
        likedTrackIds,
        likedTracks,
        playlists,
        activePlaylist,
        isLoading,
        isLiked,
        toggleLike,
        createPlaylist,
        renamePlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        reorderPlaylistTracks,
        loadActivePlaylist,
        refreshPlaylists,
        refreshLikedTracks,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = (): LibraryContextValue => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary harus digunakan di dalam LibraryProvider');
  }
  return context;
};
