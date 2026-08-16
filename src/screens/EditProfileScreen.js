// Edit Profile Screen — real-time Firestore updates
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { AppText } from '../components/ui/AppText';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

const GENRES = ['Romance', 'Mystery', 'Drama', 'Fantasy', 'Thriller', 'Comedy', 'Horror', 'Slice of Life'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

export const EditProfileScreen = () => {
  const navigation = useNavigation();
  const { user, userStats, updateUserProfile, loading: contextLoading } = useAppContext();
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [changes, setChanges] = useState({});

  // Initialize form with current user data
  useEffect(() => {
    if (userStats) {
      setFullName(userStats.fullName || user?.displayName || '');
      setPhone(userStats.phone || '');
      setGender(userStats.gender || '');
      setAge(userStats.age ? String(userStats.age) : '');
      setFavoriteGenre(userStats.favoriteGenre || '');
      setBio(userStats.bio || '');
      setProfilePic(userStats.profilePic || userStats.photoURL || user?.photoURL || null);
    } else if (user) {
      setFullName(user.displayName || '');
    }
  }, [userStats, user]);

  // Track changes for save button state
  useEffect(() => {
    const newChanges = {};
    if (fullName !== (userStats?.fullName || user?.displayName || '')) newChanges.fullName = fullName;
    if (phone !== (userStats?.phone || '')) newChanges.phone = phone;
    if (gender !== (userStats?.gender || '')) newChanges.gender = gender;
    if (age !== (userStats?.age ? String(userStats.age) : '')) newChanges.age = age;
    if (favoriteGenre !== (userStats?.favoriteGenre || '')) newChanges.favoriteGenre = favoriteGenre;
    if (bio !== (userStats?.bio || '')) newChanges.bio = bio;
    if (profilePic !== (userStats?.profilePic || userStats?.photoURL || user?.photoURL || null)) newChanges.profilePic = profilePic;
    setChanges(newChanges);
  }, [fullName, phone, gender, age, favoriteGenre, bio, profilePic, userStats, user]);

  // Real-time save with debounce
  const debouncedSave = useCallback(
    debounce(async (updates) => {
      if (Object.keys(updates).length === 0) return;
      
      try {
        setLoading(true);
        setError('');
        
        // Prepare updates - convert age to number, handle empty values
        const finalUpdates = { ...updates };
        if (finalUpdates.age) {
          finalUpdates.age = parseInt(finalUpdates.age, 10);
        } else {
          delete finalUpdates.age;
        }
        if (!finalUpdates.phone) {
          finalUpdates.phone = null;
        }
        if (!finalUpdates.bio) {
          finalUpdates.bio = null;
        }
        
        await updateUserProfile(finalUpdates);
        setSuccess('Profile updated!');
        
        // Clear success message after 2 seconds
        setTimeout(() => setSuccess(''), 2000);
      } catch (err) {
        setError('Failed to update profile. Please try again.');
        console.error('Profile update error:', err);
      } finally {
        setLoading(false);
      }
    }, 1000),
    [updateUserProfile]
  );

  // Save all changes at once
  const handleSave = useCallback(async () => {
    if (Object.keys(changes).length === 0) {
      setError('No changes to save');
      return;
    }
    
    await debouncedSave(changes);
  }, [changes, debouncedSave]);

  // --- Profile picture -------------------------------------------------------

  // Convert a picked asset into a renderable, persistable data-URI.
  const assetToDataUri = useCallback(async (asset) => {
    if (asset.base64) {
      return `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
    }
    if (asset.uri) {
      // Some platforms omit base64 even when requested — convert manually.
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return null;
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access to change your profile picture');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        // Square crop keeps the stored photo small (Firestore caps docs at 1 MiB).
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const uri = await assetToDataUri(result.assets[0]);
        if (uri) setProfilePic(uri);
      }
    } catch (err) {
      console.error('Image pick error:', err);
      Alert.alert('Failed', 'Could not load image');
    }
  }, [assetToDataUri]);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access to take a profile picture');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const uri = await assetToDataUri(result.assets[0]);
        if (uri) setProfilePic(uri);
      }
    } catch (err) {
      console.error('Camera error:', err);
      Alert.alert('Failed', 'Could not take photo');
    }
  }, [assetToDataUri]);

  const onChangeAvatar = useCallback(() => {
    Alert.alert('Change Profile Picture', 'Choose an option', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Gallery', onPress: pickImage },
      ...(profilePic ? [{ text: 'Remove', onPress: () => setProfilePic(null) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [profilePic, pickImage, takePhoto]);

  // Memoized pill components
  const GenrePill = React.memo(({ label, selected, onPress }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? theme.accent : theme.card,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <Text style={{
        fontSize: 13,
        color: selected ? '#FFFFFF' : theme.text,
        fontWeight: '500'
      }}>
        {label}
      </Text>
    </Pressable>
  ));

  const GenderPill = React.memo(({ label, selected, onPress }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? theme.accent : theme.card,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <Text style={{
        fontSize: 13,
        color: selected ? '#FFFFFF' : theme.text,
        fontWeight: '500'
      }}>
        {label}
      </Text>
    </Pressable>
  ));

  const hasChanges = useMemo(() => Object.keys(changes).length > 0, [changes]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Icon name="arrow-left" size={20} color={theme.text} />
          </Pressable>
          <AppText variant="displayM" style={styles.title}>Edit Profile</AppText>
          {hasChanges && (
            <Button
              title="Save"
              onPress={handleSave}
              loading={loading}
              size="small"
              style={styles.saveBtn}
            />
          )}
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Pressable onPress={onChangeAvatar} style={styles.avatarWrap} accessibilityLabel="Change profile picture">
            {profilePic ? (
              <Image source={{ uri: profilePic }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={[theme.gradientStart || '#B5613A', theme.gradientEnd || '#E0913A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <AppText variant="displayM" style={{ color: '#fff' }}>
                  {(fullName[0] || 'U').toUpperCase()}
                </AppText>
              </LinearGradient>
            )}
            {/* Camera badge */}
            <View style={[styles.avatarBadge, { backgroundColor: theme.accent }]}>
              <Icon name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <AppText variant="caption" color="textSecondary" style={{ marginTop: 8 }}>
            Tap to change photo
          </AppText>
          <AppText variant="h2" style={{ marginTop: 8 }}>{fullName || 'Your Name'}</AppText>
        </View>

        {/* Form */}
        <View style={[styles.form, { paddingHorizontal: 20 }]}>
          <AppText variant="label" color="text" style={styles.label}>
            Full Name
          </AppText>
          <Input
            icon="user"
            placeholder="Full name"
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              debouncedSave({ fullName: text.trim() });
            }}
            autoCapitalize="words"
          />

          <AppText variant="label" color="text" style={styles.label}>
            Phone
          </AppText>
          <Input
            icon="phone"
            placeholder="Phone number (optional)"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              debouncedSave({ phone: text.trim() });
            }}
            keyboardType="phone-pad"
          />

          <AppText variant="label" color="text" style={styles.label}>
            Gender
          </AppText>
          <View style={styles.pillRow}>
            {GENDERS.map((g) => (
              <GenderPill
                key={g}
                label={g}
                selected={gender === g}
                onPress={() => {
                  setGender(g);
                  debouncedSave({ gender: g });
                }}
              />
            ))}
          </View>

          <AppText variant="label" color="text" style={styles.label}>
            Age
          </AppText>
          <Input
            icon="calendar"
            placeholder="Age (optional)"
            value={age}
            onChangeText={(text) => {
              setAge(text);
              debouncedSave({ age: text });
            }}
            keyboardType="number-pad"
          />

          <AppText variant="label" color="text" style={styles.label}>
            Favorite Genre
          </AppText>
          <View style={styles.pillRow}>
            {GENRES.map((g) => (
              <GenrePill
                key={g}
                label={g}
                selected={favoriteGenre === g}
                onPress={() => {
                  setFavoriteGenre(g);
                  debouncedSave({ favoriteGenre: g });
                }}
              />
            ))}
          </View>

          <AppText variant="label" color="text" style={styles.label}>
            Bio
          </AppText>
          <Input
            icon="edit"
            placeholder="Tell us about yourself..."
            value={bio}
            onChangeText={(text) => {
              setBio(text);
              debouncedSave({ bio: text });
            }}
            multiline
            numberOfLines={4}
            style={{ minHeight: 100 }}
          />

          {/* Status Messages */}
          {error ? (
            <View style={[styles.message, { backgroundColor: theme.errorSoft }]}>
              <AppText variant="caption" color="error">{error}</AppText>
            </View>
          ) : null}
          
          {success ? (
            <View style={[styles.message, { backgroundColor: theme.successSoft }]}>
              <AppText variant="caption" color="success">{success}</AppText>
            </View>
          ) : null}

          {contextLoading && (
            <ActivityIndicator color={theme.accent} style={{ marginTop: 20 }} />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Debounce helper function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 20,
  },
  saveBtn: {
    minWidth: 80,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EADFCC',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  form: { marginTop: 20 },
  label: {
    marginTop: 20,
    marginBottom: 10,
    paddingLeft: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  message: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
});

export default EditProfileScreen;
