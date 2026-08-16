// Profile Setup — collect additional user details after signup.
import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '../../context/AppContext';
import { AppText } from '../../components/ui/AppText';
import { Icon } from '../../components/ui/Icon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const GENRES = ['Romance', 'Mystery', 'Drama', 'Fantasy', 'Thriller', 'Comedy', 'Horror', 'Slice of Life'];
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

export const ProfileSetupScreen = ({ navigation }) => {
  const { updateUserProfile } = useAppContext();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [favoriteGenre, setFavoriteGenre] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async () => {
    if (!fullName.trim()) return setError('Please enter your full name');
    if (!gender) return setError('Please select your gender');
    if (!favoriteGenre) return setError('Please select your favorite genre');

    try {
      setError('');
      setSubmitting(true);
      await updateUserProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        gender,
        age: age ? parseInt(age, 10) : null,
        favoriteGenre,
        profileComplete: true,
      });
      navigation.navigate('Main');
    } catch (e) {
      setError('Failed to save profile. Please try again.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const GenrePill = ({ label, selected, onPress }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.genrePill,
        {
          backgroundColor: selected ? '#B5613A' : '#FCF7EF',
          borderColor: selected ? '#B5613A' : '#EADFCC',
        },
      ]}
    >
      <Text style={{ fontSize: 13, color: selected ? '#FFFFFF' : '#2A2118', fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );

  const GenderPill = ({ label, selected, onPress }) => (
    <Pressable
      onPress={onPress}
      style={[
        styles.genderPill,
        {
          backgroundColor: selected ? '#B5613A' : '#FCF7EF',
          borderColor: selected ? '#B5613A' : '#EADFCC',
        },
      ]}
    >
      <Text style={{ fontSize: 13, color: selected ? '#FFFFFF' : '#2A2118', fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F6EFE4' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.center}>
          <LinearGradient
            colors={['#B5613A', '#E0913A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Icon name="user" size={38} color="#fff" />
          </LinearGradient>
          <AppText variant="displayM" style={{ marginTop: 16 }}>Complete your profile</AppText>
          <AppText variant="body" color="textSecondary" style={{ marginTop: 4, textAlign: 'center' }}>
            Tell us about yourself for personalized stories
          </AppText>
        </View>

        <View style={styles.form}>
          <Input
            icon="user"
            placeholder="Full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoFocus
          />

          <Input
            icon="mail"
            placeholder="Phone number (optional)"
            value={phone}
            onChangeText={setPhone}
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
                onPress={() => setGender(g)}
              />
            ))}
          </View>

          <Input
            icon="calendar"
            placeholder="Age (optional)"
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
          />

          <AppText variant="label" color="text" style={styles.label}>
            Favorite genre
          </AppText>
          <View style={styles.pillRow}>
            {GENRES.map((g) => (
              <GenrePill
                key={g}
                label={g}
                selected={favoriteGenre === g}
                onPress={() => setFavoriteGenre(g)}
              />
            ))}
          </View>

          {error ? (
            <AppText variant="caption" color="error" style={styles.error}>
              {error}
            </AppText>
          ) : null}

          <Button
            title="Continue"
            onPress={handleComplete}
            loading={submitting}
            style={{ marginTop: 24 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  center: { alignItems: 'center', paddingHorizontal: 28 },
  badge: {
    width: 78,
    height: 78,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#3C2814',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  form: { paddingHorizontal: 28, marginTop: 24 },
  label: {
    marginTop: 16,
    marginBottom: 8,
    paddingLeft: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genrePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  genderPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  error: { marginTop: 12, textAlign: 'center' },
});

export default ProfileSetupScreen;
