// Profile Editor - Compressed inline editor with Base64 picture support
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../../hooks/useTheme';
import { AppText } from '../ui/AppText';
import { Icon } from '../ui/Icon';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

const GENRES = ['Romance', 'Mystery', 'Drama', 'Fantasy', 'Thriller', 'Comedy', 'Horror', 'Slice of Life'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

export const ProfileEditor = ({
  user,
  userStats,
  updateUserProfile,
  onClose,
  onUpdate
}) => {
  const { theme } = useTheme() || { theme: {} };

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [favoriteGenre, setFavoriteGenre] = useState('');
  const [bio, setBio] = useState('');
  const [profilePic, setProfilePic] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Initialize form with current user data
  useEffect(() => {
    if (userStats) {
      setFullName(userStats.fullName || user?.displayName || '');
      setPhone(userStats.phone || '');
      setGender(userStats.gender || '');
      setAge(userStats.age ? String(userStats.age) : '');
      setFavoriteGenre(userStats.favoriteGenre || '');
      setBio(userStats.bio || '');
      setProfilePic(userStats.profilePic || userStats.photoURL || null);
    } else if (user) {
      setFullName(user.displayName || '');
    }
  }, [userStats, user]);

  // Pick image from gallery and convert to Base64
  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (!result.canceled && result.assets?.[0]) {
        setUploadingPic(true);
        const uri = result.assets[0].uri;
        // Read file as base64 using expo-file-system
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const base64Image = `data:image/jpeg;base64,${base64}`;
        setProfilePic(base64Image);
        setSuccess('Picture selected!');
        setTimeout(() => setSuccess(''), 1500);
        setUploadingPic(false);
      }
    } catch (err) {
      console.error('pickImage error:', err);
      setError('Failed to pick image');
      setUploadingPic(false);
    }
  }, []);

  // Take photo with camera
  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });
      if (!result.canceled && result.assets?.[0]) {
        setUploadingPic(true);
        const uri = result.assets[0].uri;
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const base64Image = `data:image/jpeg;base64,${base64}`;
        setProfilePic(base64Image);
        setSuccess('Picture captured!');
        setTimeout(() => setSuccess(''), 1500);
        setUploadingPic(false);
      }
    } catch (err) {
      console.error('takePhoto error:', err);
      setError('Failed to capture photo');
      setUploadingPic(false);
    }
  }, []);

  // Check if anything changed
  const hasChanges = useMemo(() => {
    return (
      fullName !== (userStats?.fullName || user?.displayName || '') ||
      phone !== (userStats?.phone || '') ||
      gender !== (userStats?.gender || '') ||
      age !== (userStats?.age ? String(userStats.age) : '') ||
      favoriteGenre !== (userStats?.favoriteGenre || '') ||
      bio !== (userStats?.bio || '') ||
      profilePic !== (userStats?.profilePic || userStats?.photoURL || null)
    );
  }, [fullName, phone, gender, age, favoriteGenre, bio, profilePic, userStats, user]);

  // Save all changes
  const handleSave = useCallback(async () => {
    if (!hasChanges) { onClose(); return; }
    try {
      setLoading(true);
      setError('');
      const updates = {};
      if (fullName !== (userStats?.fullName || user?.displayName || '')) updates.fullName = fullName.trim();
      if (phone !== (userStats?.phone || '')) updates.phone = phone.trim() || null;
      if (gender !== (userStats?.gender || '')) updates.gender = gender;
      if (age !== (userStats?.age ? String(userStats.age) : '')) updates.age = age ? parseInt(age, 10) : null;
      if (favoriteGenre !== (userStats?.favoriteGenre || '')) updates.favoriteGenre = favoriteGenre;
      if (bio !== (userStats?.bio || '')) updates.bio = bio || null;
      if (profilePic !== (userStats?.profilePic || userStats?.photoURL || null)) updates.profilePic = profilePic;
      await updateUserProfile(updates);
      setSuccess('Saved!');
      if (onUpdate) onUpdate();
      setTimeout(() => { setSuccess(''); onClose(); }, 800);
    } catch (err) {
      setError('Failed to save');
    } finally {
      setLoading(false);
    }
  }, [hasChanges, fullName, phone, gender, age, favoriteGenre, bio, profilePic, userStats, user, updateUserProfile, onClose, onUpdate]);

  // Memoized pill components
  const GenrePill = useCallback(({ label, selected }) => (
    <Pressable
      onPress={() => setFavoriteGenre(selected ? '' : label)}
      style={[styles.pill, {
        backgroundColor: selected ? theme.accent : theme.card,
        borderColor: selected ? theme.accent : theme.border,
      }]}
    >
      <Text style={{ fontSize: 11, color: selected ? '#FFF' : theme.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  ), [theme]);

  const GenderPill = useCallback(({ label, selected }) => (
    <Pressable
      onPress={() => setGender(selected ? '' : label)}
      style={[styles.pill, {
        backgroundColor: selected ? theme.accent : theme.card,
        borderColor: selected ? theme.accent : theme.border,
      }]}
    >
      <Text style={{ fontSize: 11, color: selected ? '#FFF' : theme.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  ), [theme]);

  // Avatar with edit overlay
  const AvatarWithEdit = useCallback(() => (
    <View style={styles.avatarContainer}>
      {uploadingPic ? (
        <View style={[styles.avatar, { backgroundColor: theme.card }]}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : profilePic ? (
        <Image source={{ uri: profilePic }} style={styles.avatar} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[theme.gradientStart || '#B5613A', theme.gradientEnd || '#E0913A']}
          style={styles.avatar}
        >
          <AppText variant="h2" style={{ color: '#fff' }}>{(fullName[0] || 'U').toUpperCase()}</AppText>
        </LinearGradient>
      )}
      <Pressable
        onPress={() => {
          Alert.alert('Change Picture', '', [
            { text: 'Camera', onPress: takePhoto },
            { text: 'Gallery', onPress: pickImage },
            { text: 'Remove', onPress: () => setProfilePic(null) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }}
        style={[styles.cameraBtn, { backgroundColor: theme.accent }]}
      >
        <Icon name="camera" size={12} color="#fff" />
      </Pressable>
    </View>
  ), [profilePic, fullName, theme, uploadingPic, takePhoto, pickImage]);

  return (
    <View style={[styles.overlay, { backgroundColor: theme.scrim }]}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />

      <View style={[styles.editor, { backgroundColor: theme.surface }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="x" size={20} color={theme.textSecondary} />
          </Pressable>
          <AppText variant="h3">Edit Profile</AppText>
          <Button
            title="Save"
            onPress={handleSave}
            loading={loading}
            disabled={!hasChanges && !uploadingPic}
            size="small"
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <AvatarWithEdit />
          </View>

          {/* Status messages */}
          {error ? (
            <View style={[styles.msg, { backgroundColor: theme.errorSoft }]}>
              <AppText variant="caption" color="error">{error}</AppText>
            </View>
          ) : null}
          {success ? (
            <View style={[styles.msg, { backgroundColor: theme.successSoft }]}>
              <AppText variant="caption" color="success">{success}</AppText>
            </View>
          ) : null}

          {/* Full Name + Phone row */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <AppText variant="micro" color="textTertiary" style={styles.fieldLabel}>NAME</AppText>
              <Input icon="user" placeholder="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            </View>
            <View style={styles.halfField}>
              <AppText variant="micro" color="textTertiary" style={styles.fieldLabel}>PHONE</AppText>
              <Input icon="phone" placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </View>
          </View>

          {/* Gender row */}
          <AppText variant="micro" color="textTertiary" style={styles.fieldLabel}>GENDER</AppText>
          <View style={styles.pillRow}>
            {GENDERS.map((g) => <GenderPill key={g} label={g} selected={gender === g} />)}
          </View>

          {/* Age + Genre row */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <AppText variant="micro" color="textTertiary" style={styles.fieldLabel}>AGE</AppText>
              <Input icon="calendar" placeholder="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
            </View>
            <View style={styles.halfField}>
              <AppText variant="micro" color="textTertiary" style={styles.fieldLabel}>FAVORITE</AppText>
              <View style={styles.pillRow}>
                {GENRES.map((g) => <GenrePill key={g} label={g} selected={favoriteGenre === g} />)}
              </View>
            </View>
          </View>

          {/* Bio */}
          <AppText variant="micro" color="textTertiary" style={styles.fieldLabel}>BIO</AppText>
          <Input
            icon="edit"
            placeholder="Tell us about yourself..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={2}
            style={{ minHeight: 56 }}
          />
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  editor: {
    maxHeight: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  avatarSection: { alignItems: 'center', paddingVertical: 16 },
  avatarContainer: { position: 'relative' },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  msg: {
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
});

export default ProfileEditor;
