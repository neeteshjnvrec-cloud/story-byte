// CommentSheet — bottom sheet for reading and writing comments on a story.
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
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
  const inputRef = useRef(null);

  useEffect(() => {
    if (!visible || !story) return;
    const storyId = story.id || story.storyId;
    console.log('[CommentSheet] opening for storyId:', storyId, 'keys:', Object.keys(story));
    setLoading(true);
    apiService.getComments(storyId)
      .then((c) => {
        console.log('[CommentSheet] got', c.length, 'comments:', JSON.stringify(c).slice(0, 200));
        setComments(c);
        setLoading(false);
      })
      .catch((e) => { console.error('[CommentSheet] get failed:', e.message); setComments([]); setLoading(false); });
  }, [visible, story]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !user || sending) return;
    const storyId = story.id || story.storyId;
    console.log('[CommentSheet] sending comment to storyId:', storyId, 'user:', user.uid);
    setSending(true);
    try {
      const id = await apiService.addComment(storyId, {
        authorId: user.uid,
        authorName: userStats?.fullName || user.displayName || 'Anonymous',
        authorPic: userStats?.profilePic || user.photoURL || '',
        text: trimmed,
      });
      console.log('[CommentSheet] addComment returned id:', id);
      setText('');
      const fresh = await apiService.getComments(storyId);
      console.log('[CommentSheet] after add, got', fresh.length, 'comments');
      setComments(fresh);
    } catch (e) {
      console.error('[CommentSheet] add failed:', e.message, e.code);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!user) return;
    try {
      await apiService.deleteComment(story.id || story.storyId, commentId, user.uid);
      const fresh = await apiService.getComments(story.id || story.storyId);
      setComments(fresh);
    } catch (e) {
      console.warn('Failed to delete comment:', e.message);
    }
  };

  const ownId = user?.uid;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: '#fff', borderColor: '#ccc' }]}>
          {/* Header */}
          <View style={[styles.sheetHead, { borderBottomColor: '#eee' }]}>
            <Text style={[styles.debugCounter, { color: theme.text, backgroundColor: theme.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' }]}>
              {comments.length}
            </Text>
            <AppText variant="h3" color="text">
              Comments
            </AppText>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Comment list */}
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
          ) : comments.length === 0 ? (
            <View style={styles.center}>
              <AppText variant="body" color="textSecondary">No comments yet. Start the conversation!</AppText>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 100, backgroundColor: 'white' }}>
              {comments.map((c, idx) => (
                <View key={c.id} style={[styles.commentRow, { borderBottomColor: '#eee', backgroundColor: idx % 2 === 0 ? '#e8f4ff' : '#fff8e8' }]}>
                  <View style={styles.commentBody}>
                    <View style={styles.commentMeta}>
                      <AppText variant="bodySemi" color="text" style={styles.commentAuthor}>
                        {c.authorName || 'Anonymous'}
                      </AppText>
                      <AppText variant="caption" color="textSecondary" style={styles.commentTime}>
                        {timeAgo(c.createdAt)}
                      </AppText>
                    </View>
                    <AppText variant="body" color="text" style={styles.commentText}>
                      {c.text}
                    </AppText>
                  </View>
                  {c.authorId === ownId && (
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
            <View style={[styles.inputRow, { borderTopColor: '#eee', backgroundColor: '#fff' }]}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder="Add a comment..."
                placeholderTextColor={theme.textTertiary}
                multiline
                style={[styles.input, { color: '#000', backgroundColor: '#f5f5f5' }]}
                maxLength={500}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!text.trim() || sending}
                style={[styles.sendBtn, { backgroundColor: text.trim() && !sending ? theme.accent : theme.border }]}
              >
                {sending ? (
                  <ActivityIndicator size={14} color={theme.onAccent || '#fff'} />
                ) : (
                  <Icon name="send" size={18} color={text.trim() && !sending ? '#fff' : theme.textTertiary} />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.inputRow, { borderTopColor: '#eee', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12 }]}>
              <AppText variant="body" color="textSecondary">Sign in to comment.</AppText>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', borderWidth: 1, paddingBottom: 32 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { flex: 1, paddingHorizontal: 16, paddingBottom: 8 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, gap: 8 },
  commentBody: { flex: 1 },
  commentMeta: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  commentAuthor: { fontWeight: '600' },
  commentTime: { fontSize: 11 },
  commentText: { lineHeight: 20 },
  deleteBtn: { padding: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', padding: 10, fontSize: 15, maxHeight: 100, minHeight: 44 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});

export default CommentSheet;
