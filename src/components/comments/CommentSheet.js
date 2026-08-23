// CommentSheet — bottom sheet for reading and writing comments on a story.
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { KeyboardAvoider } from '../ui/KeyboardAvoider';
import apiService from '../../services/api';
import { useAppContext } from '../../context/AppContext';

function timeAgo(dateValue) {
  if (!dateValue) return '';
  const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function CommentSheet({ story, visible, onClose }) {
  const { theme } = useTheme();
  const { user, userStats } = useAppContext();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const storyId = story?.id || story?.storyId;

  // Keyed on storyId rather than the story object: the feed rebuilds story
  // objects on every metric change, which would re-fetch on each render.
  useEffect(() => {
    if (!visible || !storyId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiService.getComments(storyId)
      .then((c) => { if (!cancelled) { setComments(c); setLoading(false); } })
      .catch(() => { if (!cancelled) { setComments([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [visible, storyId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || sending || !storyId) return;
    setSending(true);
    setError(null);
    try {
      await apiService.addComment(storyId, {
        authorId: user.uid,
        authorName: userStats?.fullName || user.displayName || 'Anonymous',
        authorPic: userStats?.profilePic || user.photoURL || '',
        text: trimmed,
      });
      setText('');
      setComments(await apiService.getComments(storyId));
    } catch (e) {
      // Shown in the sheet, not just logged: a rules-denied write is the most
      // likely failure here and it must not look like the button did nothing.
      setError('Could not post your comment. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!user || !storyId) return;
    setError(null);
    try {
      await apiService.deleteComment(storyId, commentId, user.uid);
      setComments(await apiService.getComments(storyId));
    } catch (e) {
      setError('Could not delete that comment.');
    }
  };

  const canSend = !!text.trim() && !sending;

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {/* The avoider has to BE the backdrop rather than wrap the sheet. It works
          by adding bottom padding, so it needs a flex-end aligned child with
          somewhere to be pushed; wrapping the sheet directly just squeezed its
          fixed height instead of lifting it, which is why the comment box stayed
          buried under the keyboard on Android. */}
      <KeyboardAvoider style={styles.backdrop}>
        {/* Tapping the dimmed area closes the sheet. */}
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        {/* sheetWrap has a definite height on purpose. The list and the empty
            state use flex:1, and a flex child of an auto-height parent
            collapses to zero — which is what made the comment list invisible
            when the sheet only had maxHeight. */}
        <View style={styles.sheetWrap}>
          <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Header */}
            <View style={[styles.sheetHead, { borderBottomColor: theme.divider }]}>
              <AppText variant="h3" color="text">
                {comments.length > 0 ? `Comments (${comments.length})` : 'Comments'}
              </AppText>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Icon name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={[styles.errorBar, { backgroundColor: theme.errorSoft }]}>
                <AppText variant="caption" color="error">{error}</AppText>
              </View>
            ) : null}

            {/* Comment list */}
            {loading ? (
              <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
            ) : comments.length === 0 ? (
              <View style={styles.center}>
                <Icon name="chat" size={34} color={theme.textTertiary} />
                <AppText variant="body" color="textSecondary" style={{ marginTop: 12 }}>
                  No comments yet
                </AppText>
                <AppText variant="caption" color="textTertiary" style={{ marginTop: 4 }}>
                  Start the conversation!
                </AppText>
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={{ paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                {comments.map((c) => (
                  <View key={c.id} style={[styles.commentRow, { borderBottomColor: theme.divider }]}>
                    <View style={styles.commentBody}>
                      <View style={styles.commentMeta}>
                        <AppText variant="label" color="text">
                          {c.authorName || 'Anonymous'}
                        </AppText>
                        <AppText variant="caption" color="textTertiary">
                          {timeAgo(c.createdAt)}
                        </AppText>
                      </View>
                      <AppText variant="body" color="text" style={styles.commentText}>
                        {c.text}
                      </AppText>
                    </View>
                    {c.authorId === user?.uid && (
                      <TouchableOpacity onPress={() => handleDelete(c.id)} hitSlop={8} style={styles.deleteBtn}>
                        <Icon name="trash" size={16} color={theme.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Input */}
            {user ? (
              <View style={[styles.inputRow, { borderTopColor: theme.divider }]}>
                <TextInput
                  ref={inputRef}
                  value={text}
                  onChangeText={setText}
                  placeholder="Add a comment..."
                  placeholderTextColor={theme.textTertiary}
                  multiline
                  style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
                  maxLength={500}
                />
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!canSend}
                  style={[styles.sendBtn, { backgroundColor: canSend ? theme.accent : theme.border }]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={theme.onAccent} />
                  ) : (
                    <Icon name="send" size={18} color={canSend ? theme.onAccent : theme.textTertiary} />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.signedOut, { borderTopColor: theme.divider }]}>
                <AppText variant="body" color="textSecondary">Sign in to comment.</AppText>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  // Percentage of the backdrop, which the avoider shrinks by the keyboard height
  // while typing. At the old 35% that left ~20% of the screen for the sheet —
  // header plus input row alone ate all of it and the comments vanished.
  sheetWrap: { height: '35%' },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { flex: 1, paddingHorizontal: 16 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, gap: 8 },
  commentBody: { flex: 1 },
  commentMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  commentText: { lineHeight: 20 },
  deleteBtn: { padding: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1,
  },
  input: {
    flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, maxHeight: 100, minHeight: 44,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  signedOut: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 16, alignItems: 'center' },
});

export default CommentSheet;
