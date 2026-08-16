// Floating Audio Player for Story Byte
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  SafeAreaView
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../hooks/useTheme';

export const FloatingAudioPlayer = () => {
  const { theme } = useTheme();
  const {
    currentStory,
    progress,
    isPlaying,
    duration,
    currentPage,
    totalPages,
    speed,
    playPause,
    seek,
    seekForward,
    seekBackward,
    nextPage,
    prevPage,
    cycleSpeed,
    stop
  } = useAudioPlayer();

  const [expanded, setExpanded] = useState(false);

  if (!currentStory) return null;

  const currentPageData = currentStory.pages?.[currentPage] || null;
  const displayText = currentPageData?.text || currentStory.description || '';
  const pageLabel = totalPages > 1 ? `Page ${currentPage + 1} / ${totalPages}` : '';

  const handleCollapsedPress = () => {
    setExpanded(true);
  };

  return (
    <>
      {/* Collapsed bar — always visible at bottom when a story is loaded */}
      <TouchableOpacity
        style={[styles.collapsedBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}
        onPress={() => setExpanded(true)}
        activeOpacity={0.9}
      >
        <View style={styles.collapsedInfo}>
          <Text style={[styles.collapsedTitle, { color: theme.text }]} numberOfLines={1}>
            {currentStory.title}
          </Text>
          <Text style={[styles.collapsedSubtitle, { color: theme.textSecondary }]}>
            {formatProgress(progress, duration)}{pageLabel ? ` • ${pageLabel}` : ''}
          </Text>
        </View>

        <View style={styles.collapsedControls}>
          <TouchableOpacity onPress={seekBackward} style={styles.iconBtn}>
            <Text style={styles.iconText}>⏪</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.playBtn, { backgroundColor: theme.accent }]}
            onPress={playPause}
          >
            <Text style={styles.playBtnText}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={seekForward} style={styles.iconBtn}>
            <Text style={styles.iconText}>⏩</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Expanded modal full player */}
      <Modal
        visible={expanded}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setExpanded(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setExpanded(false)} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: theme.text }]}>▼</Text>
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, { color: theme.text }]} numberOfLines={1}>
              {currentStory.title}
            </Text>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {/* Story Text */}
            <View style={[styles.textCard, { backgroundColor: theme.card }]}>
              {pageLabel ? (
                <Text style={[styles.pageLabel, { color: theme.accent }]}>{pageLabel}</Text>
              ) : null}
              <Text style={[styles.storyText, { color: theme.text }]}>
                {displayText}
              </Text>
            </View>
          </ScrollView>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={progress}
              onValueChange={(value) => {
                if (duration > 0) seek(value * duration);
              }}
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.border}
              thumbTintColor={theme.accent}
            />
            <View style={styles.timeRow}>
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                {formatProgress(progress, duration)}
              </Text>
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                {formatTime(duration)}
              </Text>
            </View>
          </View>

          {/* Main Controls */}
          <View style={styles.mainControls}>
            <TouchableOpacity
              style={styles.mainControlBtn}
              onPress={prevPage}
              disabled={currentPage === 0}
              opacity={currentPage === 0 ? 0.3 : 1}
            >
              <Text style={styles.mainControlText}>⏮</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={seekBackward} style={styles.iconBtn}>
              <Text style={styles.iconText}>⏪</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bigPlayBtn, { backgroundColor: theme.accent }]}
              onPress={playPause}
            >
              <Text style={styles.bigPlayText}>{isPlaying ? '⏸' : '▶'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={seekForward} style={styles.iconBtn}>
              <Text style={styles.iconText}>⏩</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mainControlBtn}
              onPress={nextPage}
              disabled={currentPage >= totalPages - 1}
              opacity={currentPage >= totalPages - 1 ? 0.3 : 1}
            >
              <Text style={styles.mainControlText}>⏭</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Controls: Speed + Volume + Close */}
          <View style={styles.secondaryControls}>
            <TouchableOpacity
              style={[styles.speedBtn, { backgroundColor: theme.surface }]}
              onPress={cycleSpeed}
            >
              <Text style={[styles.speedText, { color: theme.accent }]}>{speed}x</Text>
            </TouchableOpacity>

            <View style={styles.volumeContainer}>
              <Text style={[styles.volumeIcon, { color: theme.textSecondary }]}>🔊</Text>
              <Slider
                style={styles.volumeSlider}
                minimumValue={0}
                maximumValue={1}
                value={1}
                onValueChange={() => {
                  // Volume is controlled at the OS level for expo-audio
                  // This slider is for UI feedback only
                }}
                minimumTrackTintColor={theme.accent}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.accent}
              />
            </View>

            <TouchableOpacity
              style={[styles.closePlayerBtn, { backgroundColor: theme.surface }]}
              onPress={() => {
                stop();
                setExpanded(false);
              }}
            >
              <Text style={[styles.closePlayerText, { color: theme.error || '#ef4444' }]}>✕</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
};

const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatProgress = (progress, duration) => {
  if (!duration) return '0:00';
  const current = progress * duration;
  return formatTime(current);
};

const styles = StyleSheet.create({
  collapsedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000
  },
  collapsedInfo: {
    flex: 1,
    marginRight: 12
  },
  collapsedTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  collapsedSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  collapsedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  iconBtn: {
    padding: 8
  },
  iconText: {
    fontSize: 20
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playBtnText: {
    color: '#fff',
    fontSize: 18
  },
  modalContainer: {
    flex: 1,
    paddingTop: 20
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)'
  },
  closeBtn: {
    padding: 8,
    marginRight: 8
  },
  closeText: {
    fontSize: 20
  },
  modalHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold'
  },
  modalBody: {
    flex: 1
  },
  modalBodyContent: {
    padding: 16,
    paddingBottom: 24
  },
  textCard: {
    padding: 20,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3
  },
  pageLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10
  },
  storyText: {
    fontSize: 17,
    lineHeight: 26
  },
  progressSection: {
    paddingHorizontal: 16,
    paddingTop: 10
  },
  slider: {
    width: '100%',
    height: 40
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  timeText: {
    fontSize: 12
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12
  },
  mainControlBtn: {
    padding: 12
  },
  mainControlText: {
    fontSize: 26
  },
  bigPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bigPlayText: {
    color: '#fff',
    fontSize: 28
  },
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 10
  },
  speedBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20
  },
  speedText: {
    fontSize: 15,
    fontWeight: 'bold'
  },
  volumeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  volumeIcon: {
    fontSize: 18
  },
  volumeSlider: {
    flex: 1,
    height: 40
  },
  closePlayerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closePlayerText: {
    fontSize: 18,
    fontWeight: 'bold'
  }
});
