// Edit Profile Screen — full-screen modal, Base64 images, compressed layout
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
import { Button } from '../components/ui/Button';

const GENRES = ['Romance', 'Mystery', 'Drama', 'Fantasy', 'Thriller', 'Comedy', 'Horror', 'Slice of Life'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

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
  const [loading, setLoading] = useState(false);
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

  // Pick image from gallery
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
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setProfilePic(`data:image/jpeg;base64,${base64}`);
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
        setProfilePic(`data:image/jpeg;base64,${base64}`);
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

  // Save
  const handleSave = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const updates = {};
      if (fullName.trim()) updates.fullName = fullName.trim();
      updates.phone = phone.trim() || null;
      updates.gender = gender || null;
      updates.age = age ? parseInt(age, 10) : null;
      updates.favoriteGenre = favoriteGenre || null;
      updates.bio = bio || null;
      if (profilePic !== (userStats?.profilePic || userStats?.photoURL || null)) {
        updates.profilePic = profilePic;
      }
      await updateUserProfile(updates);
      setSuccess('Profile saved!');
      setTimeout(() => navigation.goBack(), 800);
    } catch (err) {
      setError('Failed to save profile');
    } finally {
      setLoading(false);
    }
  }, [fullName, phone, gender, age, favoriteGenre, bio, profilePic, userStats, updateUserProfile, navigation]);

  // Pill components
  const GenrePill = ({ label, selected }) => (
    <Pressable
      onPress={() => setFavoriteGenre(selected ? '' : label)}
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
      onPress={() => setGender(selected ? '' : label)}
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
      {/* Header — same style as Settings */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerSide}>
          <Icon name="chev-left" size={26} color={theme.text} />
        </Pressable>
        <AppText variant="h3">Edit Profile</AppText>
        <View style={styles.headerSide} />
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
                { text: 'Remove', onPress: () => setProfilePic(null) },
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
            <AppText variant="caption" color="success">{success}</AppText>
          </View>
        ) : null}

        {/* Form card — same grouped style as Settings */}
        <View style={styles.formSection}>
          <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>PERSONAL</AppText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.row}>
              <AppText variant="body" color="text" style={styles.rowLabel}>Name</AppText>
              <View style={styles.rowInput}>
                <Input icon="user" placeholder="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" style={styles.inputNoBorder} />
              </View>
            </View>
            <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.divider }]}>
              <AppText variant="body" color="text" style={styles.rowLabel}>Phone</AppText>
              <View style={styles.rowInput}>
                <Input icon="phone" placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.inputNoBorder} />
              </View>
            </View>
            <View style={styles.rowLast}>
              <AppText variant="body" color="text" style={styles.rowLabel}>Age</AppText>
              <View style={styles.rowInput}>
                <Input icon="calendar" placeholder="Age" value={age} onChangeText={setAge} keyboardType="number-pad" style={styles.inputNoBorder} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>GENDER</AppText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.pillRow}>
              {GENDERS.map((g) => <GenderPill key={g} label={g} selected={gender === g} />)}
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>FAVORITE GENRE</AppText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.pillRow}>
              {GENRES.map((g) => <GenrePill key={g} label={g} selected={favoriteGenre === g} />)}
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <AppText variant="micro" color="textTertiary" style={styles.groupLabel}>BIO</AppText>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.rowLast}>
              <View style={[styles.rowInput, { flex: 1 }]}>
                <Input
                  icon="edit"
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={3}
                  style={[styles.inputNoBorder, { minHeight: 70 }]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Save button */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <Button title="Save Profile" onPress={handleSave} loading={loading} />
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
  headerSide: { width: 40, alignItems: 'flex-start' },
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
  inputInner: {
    paddingVertical: 10,
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
