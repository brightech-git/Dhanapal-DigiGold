// src/components/ui/PaymentProcessingOverlay.tsx
//
// Full-screen "processing your payment" overlay shown while a Razorpay
// payment is being verified server-side (useRazorpay status === 'verifying').
// An animated rocket flies in place over streaking stars with an exhaust
// trail, and a checklist steps through the stages so the few seconds of
// waiting feel like progress.
//
// Rendered as an absolute-fill View (not a <Modal>) so it doesn't fight the
// Razorpay WebView modal that is closing at the same moment on iOS. Place it
// as the last child of the screen's root view. Hardware back is blocked while
// it's visible.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, BackHandler, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../theme';

const { height: SCREEN_H } = Dimensions.get('window');
const STAGE = 150;

type Props = {
  visible: boolean;
  title?: string;
  steps?: string[];
};

const DEFAULT_STEPS = ['Payment received', 'Verifying with bank', 'Updating your account'];

// Star streak x-positions / lengths / speeds (deterministic, no Math.random
// so re-renders don't reshuffle them).
const STREAKS = [
  { x: 18,  len: 26, dur: 700,  delay: 0   },
  { x: 42,  len: 14, dur: 900,  delay: 300 },
  { x: 108, len: 22, dur: 650,  delay: 150 },
  { x: 130, len: 12, dur: 850,  delay: 500 },
  { x: 70,  len: 10, dur: 1000, delay: 650 },
  { x: 94,  len: 18, dur: 750,  delay: 420 },
];

function Streak({ x, len, dur, delay, color }: { x: number; len: number; dur: number; delay: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={{
        position: 'absolute', left: x, top: -len, width: 2, height: len, borderRadius: 1,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.9, 0.9, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, STAGE + len] }) }],
      }}
    />
  );
}

function Puff({ delay, color }: { delay: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[
        s.puff,
        {
          backgroundColor: color,
          opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 46] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] }) },
          ],
        },
      ]}
    />
  );
}

export default function PaymentProcessingOverlay({ visible, title = 'Processing your payment', steps = DEFAULT_STEPS }: Props) {
  const { COLORS, FONTS } = useTheme();

  const fade   = useRef(new Animated.Value(0)).current;
  const rise   = useRef(new Animated.Value(40)).current;
  const hover  = useRef(new Animated.Value(0)).current;
  const shake  = useRef(new Animated.Value(0)).current;
  const flame  = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [activeStep, setActiveStep] = useState(0);
  const [dots, setDots] = useState('');

  // Mount / unmount with a fade
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setActiveStep(0);
      fade.setValue(0); rise.setValue(40);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(rise, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true })
        .start(() => setMounted(false));
    }
  }, [visible]);

  // Rocket hover / jitter / flame flicker
  useEffect(() => {
    if (!mounted) return;
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(hover, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(hover, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(shake, { toValue: 1,  duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0,  duration: 60, useNativeDriver: true }),
        Animated.delay(240),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(flame, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(flame, { toValue: 0, duration: 120, useNativeDriver: true }),
      ])),
    ];
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [mounted]);

  // Step through the checklist (last step stays active until done)
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setActiveStep(i => Math.min(i + 1, steps.length - 1)), 1400);
    return () => clearInterval(id);
  }, [visible, steps.length]);

  // Animated ellipsis
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setDots(d => (d.length >= 3 ? '' : d + '.')), 400);
    return () => clearInterval(id);
  }, [visible]);

  // Block Android back while processing
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  if (!mounted) return null;

  const hg: string[] = (COLORS as any)?.gradient?.orangeDeep ?? [COLORS.brandStrong, COLORS.brand];
  const deep: string = (COLORS as any)?.orangeDeep ?? COLORS.brandStrong;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: fade }]} pointerEvents="auto">
      <Animated.View style={[s.card, { backgroundColor: COLORS.surface, transform: [{ translateY: rise }] }]}>

        {/* Rocket stage */}
        <LinearGradient colors={[hg[1] ?? COLORS.brand, hg[0] ?? COLORS.brandStrong, deep]} style={s.stage}>
          {STREAKS.map((st, i) => <Streak key={i} {...st} color="rgba(255,255,255,0.75)" />)}

          <Animated.View
            style={{
              alignItems: 'center',
              transform: [
                { translateY: hover.interpolate({ inputRange: [0, 1], outputRange: [4, -6] }) },
                { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-1, 1] }) },
              ],
            }}
          >
            <View style={s.rocketWrap}>
              <Ionicons name="rocket" size={52} color="#fff" style={{ transform: [{ rotate: '-45deg' }] }} />
            </View>

            {/* Flame */}
            <Animated.View
              style={[
                s.flame,
                {
                  transform: [
                    { scaleY: flame.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) },
                  ],
                },
              ]}
            >
              <LinearGradient colors={['#FFE082', '#FFB300', 'rgba(255,111,0,0)']} style={StyleSheet.absoluteFill} />
            </Animated.View>

            {/* Exhaust puffs */}
            <View style={s.puffAnchor}>
              <Puff delay={0}   color="rgba(255,255,255,0.9)" />
              <Puff delay={300} color="rgba(255,255,255,0.9)" />
              <Puff delay={600} color="rgba(255,255,255,0.9)" />
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Copy */}
        <View style={s.body}>
          <Text style={[s.title, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
            {title}<Text style={{ color: COLORS.brand }}>{dots.padEnd(3, ' ')}</Text>
          </Text>
          <Text style={[s.sub, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]}>
            This takes a few seconds
          </Text>

          <View style={s.steps}>
            {steps.map((label, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              return (
                <View key={label} style={s.stepRow}>
                  <View
                    style={[
                      s.stepDot,
                      {
                        backgroundColor: done ? COLORS.success : active ? COLORS.brand + '18' : COLORS.surfaceMuted,
                        borderColor: done ? COLORS.success : active ? COLORS.brand : COLORS.borderSubtle,
                      },
                    ]}
                  >
                    {done
                      ? <Ionicons name="checkmark" size={12} color="#fff" />
                      : active ? <View style={[s.stepPulse, { backgroundColor: COLORS.brand }]} /> : null}
                  </View>
                  <Text
                    style={[
                      s.stepTxt,
                      {
                        color: done || active ? COLORS.contentPrimary : COLORS.contentMuted,
                        fontFamily: active ? FONTS.family.semiBold : FONTS.family.regular,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={[s.warn, { backgroundColor: COLORS.warning + '14' }]}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.warningDark ?? COLORS.warning} />
            <Text style={[s.warnTxt, { color: COLORS.contentSecondary, fontFamily: FONTS.family.medium }]}>
              Please don't close the app or go back
            </Text>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    zIndex: 999, elevation: 999,
    backgroundColor: 'rgba(8,10,18,0.62)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28,
    minHeight: SCREEN_H,
  },
  card: {
    width: '100%', maxWidth: 360, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 12,
  },
  stage: { height: STAGE, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  rocketWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  flame: { width: 14, height: 26, borderRadius: 7, overflow: 'hidden', marginTop: -10 },
  puffAnchor: { position: 'absolute', top: 74, alignItems: 'center', width: 20 },
  puff: { position: 'absolute', width: 16, height: 16, borderRadius: 8 },

  body: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 },
  title: { fontSize: 17, textAlign: 'center' },
  sub: { fontSize: 12, textAlign: 'center', marginTop: 4 },

  steps: { marginTop: 18, gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepPulse: { width: 8, height: 8, borderRadius: 4 },
  stepTxt: { fontSize: 13 },

  warn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 18, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
  },
  warnTxt: { fontSize: 11.5 },
});
