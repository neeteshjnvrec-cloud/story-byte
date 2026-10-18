// Audio Context for Story Byte — full-featured player
import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAppContext } from './AppContext';
import { useWallet } from './WalletContext';
import { isPaidStory } from '../services/wallet';
import { noteStoryFinished } from '../utils/askForRating';
import { isVideoStory } from '../utils/videoStory';
import { useVideo } from './VideoContext';

const AudioContext = createContext();

export const useAudioPlayer = () => useContext(AudioContext);

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const PROGRESS_SAVE_INTERVAL = 30000; // 30 seconds

export const AudioProvider = ({ children }) => {
  // Play counts live in AppContext's shared metric store so every screen
  // showing this story updates together.
  const { recordPlay, autoplayNext, setLastPlayTab, downloads, defaultSpeed = 1 } = useAppContext() || {};
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
  const resumeTimeRef = useRef(0);
  // Callback the consumer provides to get the next story when autoplay fires.
  const nextStoryRef = useRef(null);
  // Mirrors the autoplayNext setting so onPlaybackStatusUpdate — which is not
  // rebuilt when the setting changes — always reads the current value.
  const autoplayNextRef = useRef(autoplayNext);
  useEffect(() => { autoplayNextRef.current = autoplayNext; }, [autoplayNext]);
  // Coins: paid episodes' audio and the finish reward. Through a ref so the
  // playback callbacks below always reach the current wallet.
  const coins = useWallet();
  const coinsRef = useRef(coins);
  // The floating video player (context/VideoContext.js), for video stories.
  const video = useVideo();
  const videoRef = useRef(video);
  videoRef.current = video;
  useEffect(() => { coinsRef.current = coins; }, [coins]);

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

      // If we have a saved resume time and this is the first load, seek to it
      // Use < 1 instead of === 0 to handle small floating point values
      if (resumeTimeRef.current && resumeTimeRef.current > 0 && status.currentTime < 1) {
        const savedTime = resumeTimeRef.current;
        resumeTimeRef.current = 0; // Clear it
        console.log('[AudioContext] onPlaybackStatusUpdate: seeking to saved position', savedTime, '(currentTime:', status.currentTime, ')');
        const currentPlayer = playerRef.current;
        if (currentPlayer) {
          currentPlayer.seekTo(savedTime).then(() => {
            const newProgress = savedTime / status.duration;
            console.log('[AudioContext] onPlaybackStatusUpdate: seek successful, setting progress to', newProgress.toFixed(3));
            setProgress(newProgress);
          }).catch(err => {
            console.warn('[AudioContext] onPlaybackStatusUpdate: Failed to seek to saved position:', err);
            setProgress(0);
          });
        } else {
          console.warn('[AudioContext] onPlaybackStatusUpdate: playerRef.current is null');
        }
      } else {
        setProgress(status.currentTime / status.duration);
      }
    }
    setIsPlaying(status.playing);

    if (status.didJustFinish) {
      persistProgress();
      // Auto-advance to next page if available
      if (currentPage < totalPages - 1) {
        setCurrentPage((p) => p + 1);
      } else {
        // Listened to the end: 2 coins (once per story, a few a day).
        if (currentStoryRef.current) coinsRef.current.rewardFinish(currentStoryRef.current);
        // After a few finished stories, Google's in-app rating popup.
        noteStoryFinished();
        setIsPlaying(false);
        cleanupPlayer();
        // Clear currentStory so clicking play again restarts from beginning
        currentStoryRef.current = null;
        setCurrentStory(null);
        // Cross-story autoplay: if enabled and a next-story callback is set,
        // play it. The callback is provided by the feed screen (Community or
        // Home) and closes over that feed's current story list.
        //
        // Read through the ref, not the captured value: this callback isn't
        // rebuilt when autoplayNext changes, so the closure would keep whatever
        // the setting was when the handler was created and never see the toggle.
        if (autoplayNextRef.current && nextStoryRef.current) {
          const next = nextStoryRef.current();
          if (next) playStory(next);
        }
      }
    }
  }, [currentPage, totalPages]);

  // Play a story with optional starting page
  const playStory = useCallback(async (story, startPage = 0) => {
    try {
      // A video story has no audio: Play starts it in the floating video
      // player (components/FloatingVideoPlayer.js), which pauses this audio
      // when the video starts.
      if (isVideoStory(story)) {
        if (videoRef.current?.playMini) videoRef.current.playMini(story);
        else if (story.youtubeUrl) Linking.openURL(story.youtubeUrl).catch(() => {});
        return;
      }
      // A paid long episode plays only once unlocked: its audio URL lives in
      // premium_audio, which the rules let only unlocked listeners read.
      if (isPaidStory(story) && !story.audioUrl && !downloads?.[story.id]?.path) {
        const url = await coinsRef.current.premiumAudioUrl(story.id);
        if (!url) {
          Alert.alert('🔒 Locked episode', `Open "${story.title}" to unlock it for ${story.priceCoins} coins.`);
          return;
        }
        story = { ...story, audioUrl: url };
      }
      // Save current story's progress before switching
      console.log('[AudioContext] playStory: switching from', currentStoryRef.current?.id, 'to', story.id);
      if (playerRef.current && currentStoryRef.current) {
        try {
          const player = playerRef.current;
          const uid = uidRef.current;
          const currentStory = currentStoryRef.current;
          console.log('[AudioContext] playStory: current player state - duration:', player.duration, 'currentTime:', player.currentTime, 'durationIsReady:', player.durationIsReady);

          // Calculate progress - use player duration if ready, otherwise story duration as fallback
          const playerDuration = player.durationIsReady && player.duration > 0 ? player.duration : (currentStory.duration || 0);
          const currentTime = player.currentTime || 0;
          const savedProgress = playerDuration > 0 ? currentTime / playerDuration : 0;

          console.log('[AudioContext] playStory: calculating progress - currentTime:', currentTime, 'duration:', playerDuration, 'progress:', savedProgress.toFixed(3));

          if (uid && currentStory?.id && playerDuration > 0) {
            console.log('[AudioContext] playStory: saving progress for', currentStory.id, 'at', savedProgress.toFixed(3));
            await setDoc(doc(db, 'users', uid, 'progress', currentStory.id), {
              progress: savedProgress,
              currentTime: currentTime,
              duration: playerDuration,
              pagesCompleted: Math.floor(savedProgress * totalPages),
              speed,
              lastUpdated: serverTimestamp()
            }, { merge: true });
            console.log('[AudioContext] playStory: saved progress for', currentStory.id);
          } else {
            console.log('[AudioContext] playStory: skipped save - uid:', !!uid, 'story:', !!currentStory?.id, 'duration:', playerDuration);
          }
        } catch (e) {
          console.warn('[AudioContext] playStory: Failed to save progress before switch:', e);
        }

        // Pause old player
        try { playerRef.current.pause(); } catch (_) {}
      }

      currentStoryRef.current = story;
      setCurrentStory(story);
      setCurrentPage(startPage);

      // Determine page count from story data
      const pages = story.pages || [];
      setTotalPages(pages.length > 0 ? pages.length : 1);

      // Choose audio URL — downloaded file wins when offline; web URL is fallback.
      const downloaded = downloads?.[story.id]?.path;
      const audioUrl = downloaded
        ? downloaded
        : (pages.length > 0
            ? (pages[startPage]?.audioUrl || story.audioUrl)
            : story.audioUrl);

      if (!audioUrl) {
        console.warn('No audio URL available for this story');
        return;
      }

      // Load saved progress for this story
      let resumeProgress = 0;
      let resumeCurrentTime = 0;
      // If clicking play on the same story that just finished, restart from beginning
      const isSameStory = currentStoryRef.current && currentStoryRef.current.id === story.id;
      if (isSameStory) {
        console.log('[AudioContext] playStory: restarting finished story from beginning');
        resumeProgress = 0;
        resumeCurrentTime = 0;
      } else if (story.id && uidRef.current) {
        try {
          const progressDoc = await getDoc(doc(db, 'users', uidRef.current, 'progress', story.id));
          console.log('[AudioContext] playStory: checking progress for', story.id, '- exists:', progressDoc.exists());
          if (progressDoc.exists()) {
            const data = progressDoc.data();
            resumeProgress = Math.min(1, Math.max(0, data.progress || 0));
            resumeCurrentTime = data.currentTime || 0;
            console.log('[AudioContext] playStory: loaded saved progress for', story.id, '- progress:', resumeProgress.toFixed(3), 'currentTime:', resumeCurrentTime);
            // If progress is high enough, consider it "finished"
            if (resumeProgress >= 0.98) {
              console.log('[AudioContext] playStory: story considered finished, resetting');
              resumeProgress = 0;
              resumeCurrentTime = 0;
            }
          }
        } catch (e) {
          console.warn('[AudioContext] playStory: Failed to load saved progress:', e);
        }
      }

      // Create new player with resumed position
      const player = createAudioPlayer({ uri: audioUrl });
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

      // Set playback speed
      if (speed !== 1) {
        await player.setPlaybackRate(speed);
      }

      subscriptionRef.current = player.addListener(
        'playbackStatusUpdate',
        onPlaybackStatusUpdate
      );

      // Store resume time for when player loads
      if (resumeCurrentTime > 0) {
        console.log('[AudioContext] playStory: setting resumeTimeRef to', resumeCurrentTime);
        resumeTimeRef.current = resumeCurrentTime;
      } else {
        console.log('[AudioContext] playStory: no resume time, starting from 0');
      }

      player.play();
      setIsPlaying(true);

      // Count a play on the story (allowed by rules for signed-in users).
      // Routed through AppContext so the number moves on every screen showing
      // this story, not just in the doc. Safe to consume here: AudioProvider is
      // nested inside AppContextProvider (App.js).
      if (story?.id) {
        recordPlay?.(story);
      }

      // Record immediately (marks as played + shows in history), then auto-save.
      persistProgress();
      startProgressSaveTimer(story.id);
    } catch (error) {
      console.error('Error playing story:', error);
    }
  }, [speed, startProgressSaveTimer, onPlaybackStatusUpdate, totalPages, recordPlay]);

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
    if (!player) return;

    // Get current time (default to 0 if not ready)
    const currentTime = player.currentTime || 0;

    // Calculate new time - use player duration if ready, otherwise story duration
    const duration = player.durationIsReady && player.duration > 0
      ? player.duration
      : (currentStoryRef.current?.duration || 0);

    const newTime = Math.min(currentTime + 10, duration);
    await player.seekTo(newTime);
  }, []);

  const seekBackward = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;

    const currentTime = player.currentTime || 0;
    const duration = player.durationIsReady && player.duration > 0
      ? player.duration
      : (currentStoryRef.current?.duration || 0);

    const newTime = Math.max(currentTime - 10, 0);
    await player.seekTo(newTime);
  }, []);

  // Settings → Default speed: applies when it loads and whenever it changes,
  // including to a story already playing. The player's own speed button
  // still changes it for the session.
  useEffect(() => {
    setSpeed(defaultSpeed);
    if (playerRef.current) {
      try { playerRef.current.setPlaybackRate(defaultSpeed); } catch (e) {}
    }
  }, [defaultSpeed]);

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
        stop,
        // Set a callback that returns the next story to play when autoplay fires.
        // The consumer (CommunityScreen / HomeScreen) provides a function that
        // looks up the next story from its local feed list.
        setNextStory: (fn) => { nextStoryRef.current = fn; },
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};
