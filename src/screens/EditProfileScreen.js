// Edit Profile Screen — auto-save every field change
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';
import { GENRES } from '../constants/genres';

const GENRES = ['Romance', 'Mystery', 'Drama', 'Fantasy', 'Thriller', 'Comedy', 'Horror', 'Slice of Life'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { user, userStats, updateUserProfile } = useAppContext();
  const { theme } = useTheme() || { theme: {} };
  const insets = useSafeAreaInsets();

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [favoriteGenre, setFavoriteGenre] = useState('');
  const [bio, setBio] = useState('');
  const [profilePic, setProfilePic] = useState(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Initialize form
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

  // Generic auto-save function
  const autoSave = useCallback(debounce(async (field, value) => {
    try {
      setSaving(true);
      setError('');
      await updateUserProfile({ [field]: value });
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 1200);
    } catch (err) {
      console.error('Auto-save error:', err);
      setError('Failed to save');
      setTimeout(() => setError(''), 2000);
    } finally {
      setSaving(false);
    }
  }, 800), [updateUserProfile]);

  // Field change handlers — update state + auto-save
  const handleFullNameChange = useCallback((text) => {
    setFullName(text);
    autoSave('fullName', text.trim() || null);
  }, [autoSave]);

  const handlePhoneChange = useCallback((text) => {
    setPhone(text);
    autoSave('phone', text.trim() || null);
  }, [autoSave]);

  const handleAgeChange = useCallback((text) => {
    setAge(text);
    autoSave('age', text ? parseInt(text, 10) : null);
  }, [autoSave]);

  const handleBioChange = useCallback((text) => {
    setBio(text);
    autoSave('bio', text.trim() || null);
  }, [autoSave]);

  // Gender — instant save
  const handleGenderChange = useCallback(async (g) => {
    const newValue = gender === g ? '' : g;
    setGender(newValue);
    try {
      setSaving(true);
      await updateUserProfile({ gender: newValue || null });
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 1200);
    } catch {
      setError('Failed to save');
      setTimeout(() => setError(''), 2000);
    } finally {
      setSaving(false);
    }
  }, [gender, updateUserProfile]);

  // Genre — instant save
  const handleGenreChange = useCallback(async (g) => {
    const newValue = favoriteGenre === g ? '' : g;
    setFavoriteGenre(newValue);
    try {
      setSaving(true);
      await updateUserProfile({ favoriteGenre: newValue || null });
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 1200);
    } catch {
      setError('Failed to save');
      setTimeout(() => setError(''), 2000);
    } finally {
      setSaving(false);
    }
  }, [favoriteGenre, updateUserProfile]);

  // Save image instantly
  const saveImage = useCallback(async (base64Image) => {
    try {
      setSaving(true);
      await updateUserProfile({ profilePic: base64Image });
      setSuccess('Picture saved');
      setTimeout(() => setSuccess(''), 1200);
    } catch {
      setError('Failed to save picture');
      setTimeout(() => setError(''), 2000);
    } finally {
      setSaving(false);
    }
  }, [updateUserProfile]);

  // Remove image instantly
  const removeImage = useCallback(async () => {
    setProfilePic(null);
    try {
      setSaving(true);
      await updateUserProfile({ profilePic: null });
      setSuccess('Picture removed');
      setTimeout(() => setSuccess(''), 1200);
    } catch {
      setError('Failed to remove picture');
      setTimeout(() => setError(''), 2000);
    } finally {
      setSaving(false);
    }
  }, [updateUserProfile]);

  // Pick image
  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        // Modern array API + limited access triggers Android Photo Picker on
        // API 33+ — no READ_MEDIA_IMAGES permission needed.
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        accessPrivileges: 'limited',
      });
      if (!result.canceled && result.assets?.[0]) {
        setUploadingPic(true);
        const uri = result.assets[0].uri;
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const base64Image = `data:image/jpeg;base64,${base64}`;
        setProfilePic(base64Image);
        setUploadingPic(false);
        // Auto-save image
        await saveImage(base64Image);
      }
    } catch (err) {
      console.error('pickImage error:', err);
      setError('Failed to pick image');
      setUploadingPic(false);
    }
  }, [saveImage]);

  // Take photo
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
        setUploadingPic(false);
        // Auto-save image
        await saveImage(base64Image);
      }
    } catch (err) {
      console.error('takePhoto error:', err);
      setError('Failed to capture photo');
      setUploadingPic(false);
    }
  }, [saveImage]);

  const GenrePill = ({ label, selected }) => (
    <Pressable
      onPress={() => handleGenreChange(label)}
      style={[styles.pill, {
        backgroundColor: selected ? theme.accent : theme.card,
        borderColor: selected ? theme.accent : theme.border,
      }]}
    >
      <Text style={{ fontSize: 12, color: selected ? '#FFF' : theme.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  const GenderPill = ({ label, selected }) => (
    <Pressable
      onPress={() => handleGenderChange(label)}
      style={[styles.pill, {
        backgroundColor: selected ? theme.accent : theme.card,
        borderColor: selected ? theme.accent : theme.border,
      }]}
    >
      <Text style={{ fontSize: 12, color: selected ? '#FFF' : theme.text, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerSide}>
          <Icon name="chev-left" size={26} color={theme.text} />
        </Pressable>
        <AppText variant="h3">Edit Profile</AppText>
        <View style={styles.headerSide}>
          {saving ? <ActivityIndicator size="small" color={theme.accent} /> : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
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
              <AppText variant="displaySemi" style={{ color: '#fff' }}>
                {(fullName[0] || 'U').toUpperCase()}
              </AppText>
            </LinearGradient>
          )}
          <Pressable
            onPress={() => {
              Alert.alert('Change Picture', '', [
                { text: 'Camera', onPress: takePhoto },
                { text: 'Gallery', onPress: pickImage },
                { text: 'Remove', onPress: removeImage },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
            style={[styles.cameraBtn, { backgroundColor: theme.accent }]}
          >
            <Icon name="camera" size={14} color="#fff" />
          </Pressable>
        </View>

        {/* Status messages */}
        {error ? (
          <View style={[styles.msg, { backgroundColor: theme.errorSoft, marginHorizontal: 20 }]}>
            <AppText variant="caption" color="error">{error}</AppText>
          </View>
        ) : null}
        {success ? (
          <View style={[styles.msg, { backgroundColor: theme.successSoft, marginHorizontal: 20 }]}>
            <AppText variant="caption" color="success">✓ {success}</AppText>
          </View>
        ) : null}

        {/* PERSONAL */}
        <View style={styles.formSection}>
          <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>PERSONAL</AppText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.row}>
              <AppText variant="body" color="text" style={styles.rowLabel}>Name</AppText>
              <View style={styles.rowInput}>
                <Input icon="user" placeholder="Full name" value={fullName} onChangeText={handleFullNameChange} autoCapitalize="words" style={styles.inputNoBorder} />
              </View>
            </View>
            <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.divider }]}>
              <AppText variant="body" color="text" style={styles.rowLabel}>Phone</AppText>
              <View style={styles.rowInput}>
                <Input icon="phone" placeholder="Phone" value={phone} onChangeText={handlePhoneChange} keyboardType="phone-pad" style={styles.inputNoBorder} />
              </View>
            </View>
            <View style={styles.rowLast}>
              <AppText variant="body" color="text" style={styles.rowLabel}>Age</AppText>
              <View style={styles.rowInput}>
                <Input icon="calendar" placeholder="Age" value={age} onChangeText={handleAgeChange} keyboardType="number-pad" style={styles.inputNoBorder} />
              </View>
            </View>
          </View>
        </View>

        {/* GENDER */}
        <View style={styles.formSection}>
          <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>GENDER</AppText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.pillRow}>
              {GENDERS.map((g) => <GenderPill key={g} label={g} selected={gender === g} />)}
            </View>
          </View>
        </View>

        {/* FAVORITE GENRE */}
        <View style={styles.formSection}>
          <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>FAVORITE GENRE</AppText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.pillRow}>
              {GENRES.map((g) => <GenrePill key={g} label={g} selected={favoriteGenre === g} />)}
            </View>
          </View>
        </View>

        {/* BIO */}
        <View style={styles.formSection}>
          <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>BIO</AppText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowLast}>
              <View style={[styles.rowInput, { flex: 1 }]}>
                <Input
                  icon="edit"
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChangeText={handleBioChange}
                  multiline
                  numberOfLines={3}
                  style={[styles.inputNoBorder, { minHeight: 70 }]}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerSide: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 20,
    right: '38%',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  msg: {
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  formSection: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  groupLabel: {
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  rowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  rowLabel: {
    width: 70,
  },
  rowInput: {
    flex: 1,
  },
  inputNoBorder: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 0,
    borderRadius: 0,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
});

export default EditProfileScreen;
