// Profile Editor - Inline editable profile card with Base64 picture support
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
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
  const [activeField, setActiveField] = useState(null);

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
        Alert.alert('Permission required', 'Please allow photo library access to change your profile picture');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setUploadingPic(true);
        const asset = result.assets[0];
        
        // Use base64 directly if available, otherwise convert from URI
        let base64Image = asset.base64;
        
        if (!base64Image && asset.uri) {
          // For iOS, we might need to fetch and convert
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          base64Image = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const base64 = reader.result;
              resolve(base64);
            };
          });
        }
        
        if (base64Image) {
          setProfilePic(base64Image);
          setUploadingPic(false);
          setSuccess('Profile picture selected!');
          setTimeout(() => setSuccess(''), 2000);
        } else {
          setError('Failed to process image');
          setUploadingPic(false);
        }
      }
    } catch (err) {
      console.error('Image pick error:', err);
      setError('Failed to pick image');
      setUploadingPic(false);
    }
  }, []);

  // Take photo with camera and convert to Base64
  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access to take a profile picture');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        setUploadingPic(true);
        const asset = result.assets[0];
        
        let base64Image = asset.base64;
        
        if (!base64Image && asset.uri) {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          base64Image = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              resolve(reader.result);
            };
          });
        }
        
        if (base64Image) {
          setProfilePic(base64Image);
          setUploadingPic(false);
          setSuccess('Profile picture captured!');
          setTimeout(() => setSuccess(''), 2000);
        } else {
          setError('Failed to process photo');
          setUploadingPic(false);
        }
      }
    } catch (err) {
      console.error('Camera error:', err);
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
    if (!hasChanges) {
      onClose();
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const updates = {};
      if (fullName !== (userStats?.fullName || user?.displayName || '')) {
        updates.fullName = fullName.trim();
      }
      if (phone !== (userStats?.phone || '')) {
        updates.phone = phone.trim() || null;
      }
      if (gender !== (userStats?.gender || '')) {
        updates.gender = gender;
      }
      if (age !== (userStats?.age ? String(userStats.age) : '')) {
        updates.age = age ? parseInt(age, 10) : null;
      }
      if (favoriteGenre !== (userStats?.favoriteGenre || '')) {
        updates.favoriteGenre = favoriteGenre;
      }
      if (bio !== (userStats?.bio || '')) {
        updates.bio = bio || null;
      }
      if (profilePic !== (userStats?.profilePic || userStats?.photoURL || null)) {
        updates.profilePic = profilePic;
      }

      await updateUserProfile(updates);
      setSuccess('Profile saved!');
      
      if (onUpdate) onUpdate();
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 1000);
    } catch (err) {
      setError('Failed to save profile');
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  }, [hasChanges, fullName, phone, gender, age, favoriteGenre, bio, profilePic, userStats, user, updateUserProfile, onClose, onUpdate]);

  // Field focus handlers
  const focusField = useCallback((field) => {
    setActiveField(field);
  }, []);

  const blurField = useCallback(() => {
    setActiveField(null);
  }, []);

  // Memoized pill components
  const GenrePill = useCallback(({ label, selected }) => (
    <Pressable
      onPress={() => setFavoriteGenre(selected ? '' : label)}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? theme.accent : theme.card,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <Text style={{
        fontSize: 12,
        color: selected ? '#FFFFFF' : theme.text,
        fontWeight: '500'
      }}>
        {label}
      </Text>
    </Pressable>
  ), [theme]);

  const GenderPill = useCallback(({ label, selected }) => (
    <Pressable
      onPress={() => setGender(selected ? '' : label)}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? theme.accent : theme.card,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <Text style={{
        fontSize: 12,
        color: selected ? '#FFFFFF' : theme.text,
        fontWeight: '500'
      }}>
        {label}
      </Text>
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
        <Image 
          source={{ uri: profilePic }}
          style={styles.avatar}
          resizeMode="cover"
        />
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
      
      {/* Edit overlay */}
      <Pressable
        onPress={() => {
          Alert.alert(
            'Change Profile Picture',
            'Choose an option',
            [
              { text: 'Take Photo', onPress: takePhoto },
              { text: 'Choose from Gallery', onPress: pickImage },
              { text: 'Remove', onPress: () => setProfilePic(null) },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        }}
        style={styles.editOverlay}
      >
        <View style={[styles.editBadge, { backgroundColor: theme.accent }]}>
          <Icon name="camera" size={14} color="#fff" />
        </View>
      </Pressable>
    </View>
  ), [profilePic, fullName, theme, uploadingPic, takePhoto, pickImage]);

  return (
    <View style={[styles.overlay, { backgroundColor: theme.scrim }]}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      
      <View style={[styles.editor, { backgroundColor: theme.surface }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <AppText variant="h2">Edit Profile</AppText>
          <View style={styles.headerActions}>
            <Button
              title="Cancel"
              variant="ghost"
              onPress={onClose}
              size="small"
            />
            <Button
              title="Save"
              onPress={handleSave}
              loading={loading}
              disabled={!hasChanges && !uploadingPic}
              size="small"
              style={{ marginLeft: 8 }}
            />
          </View>
        </View>

        {/* Scrollable content */}
        <View style={styles.content}>
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <AvatarWithEdit />
            <AppText variant="h3" style={{ marginTop: 8 }}>
              {fullName || user?.displayName || 'Your Name'}
            </AppText>
          </View>

          {/* Status messages */}
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

          {/* Form fields */}
          <View style={styles.form}>
            <AppText variant="label" color="text" style={styles.fieldLabel}>
              Full Name
            </AppText>
            <Input
              icon="user"
              placeholder="Your full name"
              value={fullName}
              onChangeText={setFullName}
              onFocus={() => focusField('fullName')}
              onBlur={blurField}
              autoCapitalize="words"
            />

            <AppText variant="label" color="text" style={styles.fieldLabel}>
              Phone
            </AppText>
            <Input
              icon="phone"
              placeholder="Phone number"
              value={phone}
              onChangeText={setPhone}
              onFocus={() => focusField('phone')}
              onBlur={blurField}
              keyboardType="phone-pad"
            />

            <AppText variant="label" color="text" style={styles.fieldLabel}>
              Gender
            </AppText>
            <View style={styles.pillRow}>
              {GENDERS.map((g) => (
                <GenderPill key={g} label={g} selected={gender === g} />
              ))}
            </View>

            <AppText variant="label" color="text" style={styles.fieldLabel}>
              Age
            </AppText>
            <Input
              icon="calendar"
              placeholder="Your age"
              value={age}
              onChangeText={setAge}
              onFocus={() => focusField('age')}
              onBlur={blurField}
              keyboardType="number-pad"
            />

            <AppText variant="label" color="text" style={styles.fieldLabel}>
              Favorite Genre
            </AppText>
            <View style={styles.pillRow}>
              {GENRES.map((g) => (
                <GenrePill key={g} label={g} selected={favoriteGenre === g} />
              ))}
            </View>

            <AppText variant="label" color="text" style={styles.fieldLabel}>
              Bio
            </AppText>
            <Input
              icon="edit"
              placeholder="Tell us about yourself..."
              value={bio}
              onChangeText={setBio}
              onFocus={() => focusField('bio')}
              onBlur={blurField}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80 }}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  editor: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    maxHeight: '70%',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    marginTop: 8,
  },
  fieldLabel: {
    marginTop: 12,
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
  },
  message: {
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: 'center',
  },
});

export default ProfileEditor;
