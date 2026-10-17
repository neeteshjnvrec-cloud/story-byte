// The one YouTube video playing in the app, kept above every screen so it
// doesn't stop when you leave its story page (components/FloatingVideoPlayer.js).
//
//   inline — on the video's story page, laid over the space the page keeps
//            for it (`frame`, in window coordinates).
//   mini   — a small floating window on any other screen, until it's closed;
//            also where a video story's Play button starts it.
//
// The player is the same WebView in both, only resized, so the video never
// reloads. Watching counts like listening: one play per visit and the place
// saved for History and Continue listening.
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import apiService from '../services/api';
import { useAppContext } from './AppContext';

const VideoContext = createContext(null);

export function VideoProvider({ children }) {
  const { user, recordPlay } = useAppContext();
  // { story, videoId, counts } — counts: the story exists in Firestore, so
  // its plays and progress can be saved.
  const [video, setVideo] = useState(null);
  const [mode, setMode] = useState('inline');
  const [frame, setFrame] = useState(null);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const countedPlay = useRef(false);
  const videoRef = useRef(null);
  videoRef.current = video;

  // Signing out (or in as someone else) closes it.
  React.useEffect(() => { setVideo(null); started.current = false; }, [user?.uid]);

  /** The story page shows `story`'s video in `frame`. */
  const showInline = useCallback((story, nextFrame, { counts = true } = {}) => {
    const current = videoRef.current;
    if (!current || current.story.id !== story.id) {
      started.current = false;
      countedPlay.current = false;
      setPlaying(false);
    }
    setVideo({ story, videoId: story.youtubeId, counts });
    if (nextFrame) setFrame(nextFrame);
    setMode('inline');
  }, []);

  /** A Play button on a video story: start it in the mini window. */
  const playMini = useCallback((story) => {
    const current = videoRef.current;
    if (current?.story.id === story.id) { setMode((m) => m); return; }
    started.current = false;
    countedPlay.current = false;
    setPlaying(false);
    // A story from Firestore has createdAt; the website's list stand-in
    // (LongVideosRow) doesn't, and has no record to count plays on.
    setVideo({ story, videoId: story.youtubeId, counts: !!story.createdAt });
    setMode('mini');
  }, []);

  /** The story page of `storyId` was left: keep playing small, or close if it never started. */
  const leave = useCallback((storyId) => {
    if (videoRef.current?.story.id !== storyId) return;
    if (started.current) setMode('mini');
    else setVideo(null);
  }, []);

  const closeVideo = useCallback(() => {
    setVideo(null);
    setPlaying(false);
    started.current = false;
  }, []);

  const onPlayerEvent = useCallback((e) => {
    const current = videoRef.current;
    if (!current) return;
    if (e.type === 'play') { started.current = true; setPlaying(true); }
    if (e.type === 'pause' || e.type === 'ended') setPlaying(false);
    if (!current.counts || !user) return;
    if (e.type === 'play' && !countedPlay.current) {
      countedPlay.current = true;
      recordPlay(current.story);
    }
    const at = e.type === 'ended' ? e.duration : e.currentTime;
    apiService.saveVideoProgress(current.story, at, e.duration).catch(() => {});
  }, [user, recordPlay]);

  const value = useMemo(() => ({
    video, mode, frame, playing, showInline, playMini, leave, closeVideo, onPlayerEvent,
  }), [video, mode, frame, playing, showInline, playMini, leave, closeVideo, onPlayerEvent]);

  return <VideoContext.Provider value={value}>{children}</VideoContext.Provider>;
}

export const useVideo = () => useContext(VideoContext);
