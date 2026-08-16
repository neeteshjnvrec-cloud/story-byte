// Audio Context for Story Byte — full-featured player
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { doc, setDoc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

const AudioContext = createContext();

export const useAudioPlayer = () => useContext(AudioContext);

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const PROGRESS_SAVE_INTERVAL = 30000; // 30 seconds

export const AudioProvider = ({ children }) => {
  const [currentStory, setCurrentStory] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);

  const playerRef = useRef(null);
  const subscriptionRef = useRef(null);
  const progressTimerRef = useRef(null);
  const uidRef = useRef(null);
  const currentStoryRef = useRef(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const cleanupPlayer = () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.remove();
      playerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  // Save the current listening position to Firestore. Ref-based so it's safe to
  // call from anywhere (start / pause / finish / stop / unmount) without stale
  // closures. Denormalizes title/cover so History renders without extra reads.
  const persistProgress = async () => {
    const player = playerRef.current;
    const uid = uidRef.current;
    const story = currentStoryRef.current;
    if (!uid || !story) return;
    const dur = (player && player.durationIsReady && player.duration) || story.duration || 0;
    const cur = (player && player.currentTime) || 0;
    const prog = dur ? Math.min(cur / dur, 1) : 0;
    try {
      await setDoc(doc(db, 'users', uid, 'progress', story.id), {
        storyId: story.id,
        title: story.title || '',
        coverImage: story.coverImage || null,
        genre: story.genre || null,
        language: story.language || null,
        duration: dur,
        currentTime: cur,
        progress: prog,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) { /* best effort */ }
  };

  // Save progress to Firestore every PROGRESS_SAVE_INTERVAL ms
  const startProgressSaveTimer = useCallback((storyId) => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(async () => {
      const uid = uidRef.current;
      if (!uid || !storyId) return;
      const player = playerRef.current;
      if (!player || !player.duration || !player.durationIsReady) return;
      try {
        const currentProgress = player.currentTime / player.duration;
        const pagesCompleted = Math.floor(currentProgress * totalPages);
        await setDoc(doc(db, 'users', uid, 'progress', storyId), {
          progress: currentProgress,
          currentTime: player.currentTime,
          duration: player.duration,
          pagesCompleted,
          speed,
          lastUpdated: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn('Progress save failed:', err?.message);
      }
    }, PROGRESS_SAVE_INTERVAL);
  }, [speed, totalPages]);

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status.isLoaded) return;

    if (status.duration > 0) {
      setDuration(status.duration);
      setProgress(status.currentTime / status.duration);
    }
    setIsPlaying(status.playing);

    if (status.didJustFinish) {
      persistProgress();
      // Auto-advance to next page if available
      if (currentPage < totalPages - 1) {
        setCurrentPage((p) => p + 1);
      } else {
        setIsPlaying(false);
        cleanupPlayer();
      }
    }
  }, [currentPage, totalPages]);

  // Play a story with optional starting page
  const playStory = useCallback(async (story, startPage = 0) => {
    try {
      // Instantly pause any currently playing story — don't wait for full
      // cleanup (which is async and causes a delay). The old player will be
      // torn down lazily below once the new one is ready.
      if (playerRef.current) {
        try { playerRef.current.pause(); } catch (_) {}
      }

      currentStoryRef.current = story;
      setCurrentStory(story);
      setProgress(0);
      setDuration(0);
      setCurrentPage(startPage);

      // Determine page count from story data
      const pages = story.pages || [];
      setTotalPages(pages.length > 0 ? pages.length : 1);

      // Choose audio URL — if pages exist, use the page's audio
      const audioUrl = pages.length > 0
        ? (pages[startPage]?.audioUrl || story.audioUrl)
        : story.audioUrl;

      if (!audioUrl) {
        console.warn('No audio URL available for this story');
        return;
      }

      const player = createAudioPlayer({ uri: audioUrl });
      playerRef.current = player;

      // Tear down the old player now that the new one is created.
      // Subscription and progress timer are replaced below.
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      // Set playback speed
      if (speed !== 1) {
        await player.setPlaybackRate(speed);
      }

      subscriptionRef.current = player.addListener(
        'playbackStatusUpdate',
        onPlaybackStatusUpdate
      );
      player.play();
      setIsPlaying(true);

      // Count a play on the story (allowed by rules for signed-in users).
      if (story?.id) {
        updateDoc(doc(db, 'stories', story.id), { plays: increment(1), lastPlayedAt: serverTimestamp() }).catch(() => {});
      }

      // Record immediately (marks as played + shows in history), then auto-save.
      persistProgress();
      startProgressSaveTimer(story.id);
    } catch (error) {
      console.error('Error playing story:', error);
    }
  }, [speed, startProgressSaveTimer, onPlaybackStatusUpdate]);

  // Navigate to a specific page
  const goToPage = useCallback(async (pageIndex) => {
    if (!currentStory || pageIndex < 0 || pageIndex >= totalPages) return;

    const pages = currentStory.pages || [];
    if (pages.length === 0) return;

    const pageAudio = pages[pageIndex]?.audioUrl;
    if (!pageAudio) return;

    // Instantly pause the old player — don't wait for full async cleanup.
    if (playerRef.current) {
      try { playerRef.current.pause(); } catch (_) {}
    }

    setCurrentPage(pageIndex);
    setProgress(0);
    setDuration(0);

    const player = createAudioPlayer({ uri: pageAudio });
    playerRef.current = player;

    // Tear down old subscriptions/timer now that the new player is ready.
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (speed !== 1) {
      await player.setPlaybackRate(speed);
    }

    subscriptionRef.current = player.addListener(
      'playbackStatusUpdate',
      onPlaybackStatusUpdate
    );
    player.play();
    setIsPlaying(true);
  }, [currentStory, totalPages, speed, onPlaybackStatusUpdate]);

  const nextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  const playPause = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;

    if (player.playing) {
      player.pause();
      setIsPlaying(false);
      persistProgress();
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, []);

  const seek = useCallback(async (positionSeconds) => {
    const player = playerRef.current;
    if (!player) return;
    await player.seekTo(positionSeconds);
  }, []);

  const seekForward = useCallback(async () => {
    const player = playerRef.current;
    if (!player || !player.durationIsReady) return;
    const newTime = Math.min(player.currentTime + 10, player.duration);
    await player.seekTo(newTime);
  }, []);

  const seekBackward = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    const newTime = Math.max(player.currentTime - 10, 0);
    await player.seekTo(newTime);
  }, []);

  const cycleSpeed = useCallback(() => {
    const currentIndex = SPEEDS.indexOf(speed);
    const nextIndex = (currentIndex + 1) % SPEEDS.length;
    setSpeed(SPEEDS[nextIndex]);
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(SPEEDS[nextIndex]);
    }
  }, [speed]);

  const setVolumeLevel = useCallback((level) => {
    const clamped = Math.max(0, Math.min(1, level));
    setVolume(clamped);
  }, []);

  const stop = useCallback(async () => {
    persistProgress();
    cleanupPlayer();
    currentStoryRef.current = null;
    setCurrentStory(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setCurrentPage(0);
    setTotalPages(1);
  }, []);

  // Save progress when unmounting or stopping
  const saveFinalProgress = useCallback(async () => {
    const player = playerRef.current;
    const uid = uidRef.current;
    const story = currentStory;
    if (!uid || !story || !player || !player.durationIsReady) return;
    try {
      const currentProgress = player.currentTime / player.duration;
      const pagesCompleted = Math.floor(currentProgress * totalPages);
      await setDoc(doc(db, 'users', uid, 'progress', story.id), {
        progress: currentProgress,
        currentTime: player.currentTime,
        duration: player.duration,
        pagesCompleted,
        speed,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      // silent
    }
  }, [currentStory, speed, totalPages]);

  useEffect(() => {
    return () => {
      persistProgress();
      cleanupPlayer();
    };
  }, []);

  // Set UID from Firebase auth on mount
  useEffect(() => {
    const authModule = require('firebase/auth');
    const subscriber = authModule.onAuthStateChanged(authModule.getAuth(), (u) => {
      uidRef.current = u?.uid || null;
    });
    return subscriber;
  }, []);

  return (
    <AudioContext.Provider
      value={{
        currentStory,
        progress,
        isPlaying,
        duration,
        currentPage,
        totalPages,
        speed,
        volume,
        speeds: SPEEDS,
        playStory,
        playPause,
        seek,
        seekForward,
        seekBackward,
        nextPage,
        prevPage,
        goToPage,
        cycleSpeed,
        setVolumeLevel,
        stop
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
