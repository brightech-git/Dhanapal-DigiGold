import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  Linking, Image, ImageSourcePropType, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store/store';
import { logoutUser } from '../../store/authSlice';

type Props = {
  mode: 'update' | 'maintenance';
  latestVersion?: string;
  storeUrl?: string;
  maintenanceMsg?: string;
  logo?: ImageSourcePropType;
};

export default function UpdateScreen({ mode, latestVersion, storeUrl, maintenanceMsg, logo }: Props) {
  const { COLORS, FONTS, SIZES, moderateScale } = useTheme();
  const dispatch = useDispatch<AppDispatch>();

  const fade  = useRef(new Animated.Value(0)).current;
  const rise  = useRef(new Animated.Value(20)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 540, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleUpdate = async () => {
    await dispatch(logoutUser());
    if (storeUrl) Linking.openURL(storeUrl);
  };

  const ring = moderateScale(96);
  const spin = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const isUpdate = mode === 'update';

  return (
    <View style={[s.root, { backgroundColor: COLORS.brandDeep }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.brandDeep} />

      <LinearGradient
        colors={COLORS.gradient.brandDeep as [string, string, ...string[]]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient bloom */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[s.bloom, { backgroundColor: COLORS.brandAlpha16 }]} />
      </View>

      <Animated.View style={[s.body, { opacity: fade, transform: [{ translateY: rise }] }]}>

        {/* Spinning arc + logo */}
        <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[s.arc, {
            width: ring, height: ring, borderRadius: ring / 2,
            borderColor: COLORS.whiteAlpha20,
            borderTopColor: COLORS.accentDeep,
            transform: [{ rotate: spin }],
          }]} />
          {logo ? (
            <Image
              source={logo}
              resizeMode="cover"
              style={{ width: ring * 0.56, height: ring * 0.56, borderRadius: ring * 0.28 }}
            />
          ) : (
            <Text style={{ fontFamily: FONTS.family.trajanBold, fontSize: moderateScale(30), color: COLORS.accentDeep, letterSpacing: 1 }}>
              D
            </Text>
          )}
        </View>

        {/* Icon badge */}
        <View style={[s.badge, {
          backgroundColor: isUpdate ? COLORS.accentDeep : COLORS.warning,
          marginTop: SIZES.margin.xxl,
        }]}>
          <Ionicons
            name={isUpdate ? 'arrow-up-circle' : 'construct-outline'}
            size={moderateScale(28)}
            color={COLORS.brandDeep}
          />
        </View>

        {/* Heading */}
        <Text style={[s.heading, {
          fontFamily: FONTS.family.bold,
          color: COLORS.white,
          marginTop: SIZES.margin.xl,
        }]}>
          {isUpdate ? 'New Update Available' : 'Under Maintenance'}
        </Text>

        <Text style={[s.eyebrow, {
          fontFamily: FONTS.family.semiBold,
          color: COLORS.accentDeep,
          marginTop: 4,
        }]}>
          {isUpdate ? `VERSION ${latestVersion ?? ''}` : 'BACK SOON'}
        </Text>

        {/* Body text */}
        <Text style={[s.body2, {
          fontFamily: FONTS.family.regular,
          color: COLORS.whiteAlpha70,
          marginTop: SIZES.margin.xl,
          paddingHorizontal: SIZES.padding.xxl,
        }]}>
          {isUpdate
            ? `A new version of Dhanapal DigiGold is available with the latest features and improvements.\n\nPlease update the app to continue.`
            : (maintenanceMsg || 'We are currently performing scheduled maintenance.\n\nPlease check back shortly.')}
        </Text>

        <View style={[s.divider, { backgroundColor: COLORS.whiteAlpha20, marginVertical: SIZES.margin.xxl }]} />

        {/* CTA */}
        {isUpdate && storeUrl ? (
          <View style={{ width: '100%', paddingHorizontal: SIZES.padding.xxl }}>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: COLORS.accentDeep }]}
              onPress={handleUpdate}
              activeOpacity={0.85}
            >
              <Text style={[s.btnText, { fontFamily: FONTS.family.bold, color: COLORS.brandDeep }]}>
                Update Now
              </Text>
            </TouchableOpacity>
            <Text style={[s.hint, { fontFamily: FONTS.family.regular, color: COLORS.whiteAlpha50 }]}>
              You must update to continue using the app
            </Text>
          </View>
        ) : (
          <View style={[s.pill, { borderColor: COLORS.whiteAlpha20 }]}>
            <Ionicons name="time-outline" size={14} color={COLORS.whiteAlpha50} />
            <Text style={[s.hint, { fontFamily: FONTS.family.regular, color: COLORS.whiteAlpha50 }]}>
              No action needed — we'll be back shortly
            </Text>
          </View>
        )}
      </Animated.View>

      <Animated.Text style={[s.footer, {
        opacity: fade,
        fontFamily: FONTS.family.regular,
        color: COLORS.whiteAlpha50,
        paddingBottom: moderateScale(28),
        paddingHorizontal: SIZES.padding.xxl,
      }]}>
        Dhanapal DigiGold · Secured savings · Hallmarked metal
      </Animated.Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, justifyContent: 'space-between', alignItems: 'center' },
  bloom:   { position: 'absolute', top: -120, alignSelf: 'center', width: 320, height: 320, borderRadius: 160 },
  body:    { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' },
  arc:     { position: 'absolute', borderWidth: 2 },
  badge:   { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, textAlign: 'center', letterSpacing: 0.5 },
  eyebrow: { fontSize: 11, letterSpacing: 3, textAlign: 'center' },
  body2:   { fontSize: 13, textAlign: 'center', lineHeight: 22 },
  divider: { width: 48, height: 1 },
  btn:     { paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { fontSize: 15, letterSpacing: 0.5 },
  hint:    { fontSize: 11, textAlign: 'center', marginTop: 10 },
  pill:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  footer:  { fontSize: 10, textAlign: 'center' },
});
