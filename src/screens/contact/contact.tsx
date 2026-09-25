// src/screens/contact/contact.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../../components/ui/appcomponents/AppHeader';
import { useTheme } from '../../theme';
import PoweredByFooter from '../../components/ui/PoweredByFooter';
import { useCompanies } from '../../api/hooks/Company/useCompanies';
import { Company } from '../../types/Company/Company';

// ── Company helpers ───────────────────────────────────────────────
const companyAddress = (c: Company): string => {
  const lines = [c.ADDRESS1, c.ADDRESS2, c.ADDRESS3, c.ADDRESS4]
    .map(x => (x ?? '').trim())
    .filter(Boolean);
  const base = lines.join(', ');
  return c.AREACODE ? `${base}${base ? ' - ' : ''}${c.AREACODE}` : base;
};
const telHref  = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, '')}`;
const mapsHref = (c: Company) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.COMPANYNAME} ${companyAddress(c)}`)}`;

// Build the list of social / store links that actually have a value.
type LinkItem = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; url: string };
const socialLinksOf = (c?: Company): LinkItem[] => {
  if (!c) return [];
  const defs: { key: keyof Company; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { key: 'WHATSAPPLINK',       label: 'WhatsApp',   icon: 'logo-whatsapp',         color: '#25D366' },
    { key: 'FACEBOOKLINK',       label: 'Facebook',   icon: 'logo-facebook',         color: '#1877F2' },
    { key: 'INSTALINK',          label: 'Instagram',  icon: 'logo-instagram',        color: '#E4405F' },
    { key: 'TWITTERLINK',        label: 'Twitter',    icon: 'logo-twitter',          color: '#1DA1F2' },
    { key: 'YOUTUBELINK',        label: 'YouTube',    icon: 'logo-youtube',          color: '#FF0000' },
    { key: 'GOOGLEBUSINESSLINK', label: 'Google',     icon: 'logo-google',           color: '#4285F4' },
    { key: 'APPSTORELINK',       label: 'App Store',  icon: 'logo-apple',            color: '#0A84FF' },
    { key: 'ANDROIDLINK',        label: 'Play Store', icon: 'logo-google-playstore', color: '#34A853' },
  ];
  return defs
    .map(d => ({ key: String(d.key), label: d.label, icon: d.icon, color: d.color, url: ((c[d.key] as string | undefined) ?? '').trim() }))
    .filter(d => d.url.length > 0);
};

// ── Form field helper ─────────────────────────────────────────────
function FormField({
  label, icon, value, placeholder, onChangeText, multiline = false, keyboardType = 'default', colors, fonts,
}: {
  label: string; icon: keyof typeof Ionicons.glyphMap; value: string;
  placeholder: string; onChangeText: (v: string) => void;
  multiline?: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad';
  colors: any; fonts: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fStyles.wrap}>
      <Text style={[fStyles.label, { color: colors.contentSecondary, fontFamily: fonts.family.medium }]}>{label}</Text>
      <View style={[
        fStyles.box,
        {
          borderColor: focused ? colors.brand : colors.borderSubtle,
          backgroundColor: focused ? colors.brand + '05' : colors.surface,
          height: multiline ? 100 : 50,
          alignItems: multiline ? 'flex-start' : 'center',
        }
      ]}>
        <Ionicons name={icon} size={18} color={focused ? colors.brand : colors.contentMuted} style={[fStyles.icon, multiline && { marginTop: 14 }]} />
        <TextInput
          style={[fStyles.input, { color: colors.contentPrimary, fontFamily: fonts.family.regular }, multiline && { textAlignVertical: 'top', paddingTop: 14 }]}
          placeholder={placeholder} placeholderTextColor={colors.contentMuted}
          value={value} onChangeText={onChangeText} multiline={multiline}
          numberOfLines={multiline ? 4 : 1} keyboardType={keyboardType}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}
const fStyles = StyleSheet.create({
  wrap:  { marginBottom: 14 },
  label: { fontSize: 13, marginBottom: 6 },
  box:   { flexDirection: 'row', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12 },
  icon:  { marginRight: 10 },
  input: { flex: 1, fontSize: 14, height: '100%' },
});

// ── Main Screen ──────────────────────────────────────────────────
export default function ContactScreen() {
  const { COLORS, FONTS, SIZES, SHADOWS } = useTheme();
  const navigation = useNavigation<any>();

  const { companies, loading: companiesLoading, error: companiesError } = useCompanies();

  // Social / store links from the first company that has any (only show present ones)
  const socialLinks = socialLinksOf(companies.find(c => socialLinksOf(c).length > 0) ?? companies[0]);

  const [cName,    setCName]    = useState('');
  const [cEmail,   setCEmail]   = useState('');
  const [cPhone,   setCPhone]   = useState('');
  const [cMessage, setCMessage] = useState('');
  const [sent,     setSent]     = useState(false);

  const isFormValid = cName.trim().length > 1 && cEmail.includes('@') && cMessage.trim().length > 5;

  const handleSend = () => {
    if (!isFormValid) return;
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setCName(''); setCEmail(''); setCPhone(''); setCMessage('');
    }, 3000);
  };

  return (<>
             <AppHeader
            title="Contact"
            showBack
            onBackPress={() => (navigation as any).navigate('Main', { screen: 'Home' })}
            
          />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, { paddingHorizontal: SIZES.padding.container }]}>


          {/* ── Our Branches (from /api/v1/company/all) ── */}
          <View style={s.branchSec}>
            {/* <Text style={[s.sectionHead, { color: COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]}>
              Our Branches
            </Text> */}

            {companiesLoading ? (
              <View style={[s.branchCard, { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle, alignItems: 'center' }]}>
                <ActivityIndicator color={COLORS.brand} />
              </View>
            ) : companiesError ? (
              <View style={[s.branchCard, { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle }]}>
                <Text style={[s.cardValue, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
                  {companiesError}
                </Text>
              </View>
            ) : companies.length === 0 ? (
              <View style={[s.branchCard, { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle }]}>
                <Text style={[s.cardValue, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
                  No branch details available.
                </Text>
              </View>
            ) : (
              companies.map((c) => {
                const addr = companyAddress(c);
                return (
                  <View key={c.COMPANYID} style={[s.branchCard, { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle, ...SHADOWS.sm }]}>
                    {/* Name */}
                    <View style={s.branchHead}>
                      <View style={[s.branchIcon, { backgroundColor: COLORS.brand + '15' }]}>
                        <Ionicons name="business-outline" size={20} color={COLORS.brand} />
                      </View>
                      <Text style={[s.branchName, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]} numberOfLines={2}>
                        {c.COMPANYNAME}
                      </Text>
                    </View>

                    {/* Address */}
                    {addr ? (
                      <View style={s.branchRow}>
                        <Ionicons name="location-outline" size={16} color={COLORS.contentMuted} style={s.branchRowIcon} />
                        <Text style={[s.branchRowTxt, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
                          {addr}
                        </Text>
                      </View>
                    ) : null}

                    {/* Phone */}
                    {c.PHONE ? (
                      <TouchableOpacity style={s.branchRow} onPress={() => Linking.openURL(telHref(c.PHONE!))} activeOpacity={0.7}>
                        <Ionicons name="call-outline" size={16} color={COLORS.brand} style={s.branchRowIcon} />
                        <Text style={[s.branchRowTxt, { color: COLORS.brand, fontFamily: FONTS.family.medium }]}>{c.PHONE}</Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* Email */}
                    {c.EMAIL ? (
                      <TouchableOpacity style={s.branchRow} onPress={() => Linking.openURL(`mailto:${c.EMAIL}`)} activeOpacity={0.7}>
                        <Ionicons name="mail-outline" size={16} color={COLORS.brand} style={s.branchRowIcon} />
                        <Text style={[s.branchRowTxt, { color: COLORS.brand, fontFamily: FONTS.family.medium }]} numberOfLines={1}>{c.EMAIL}</Text>
                      </TouchableOpacity>
                    ) : null}

                    {/* Directions */}
                    {addr ? (
                      <TouchableOpacity style={[s.branchBtn, { backgroundColor: COLORS.brand }]} onPress={() => Linking.openURL(mapsHref(c))} activeOpacity={0.85}>
                        <Ionicons name="navigate-outline" size={14} color={COLORS.white} />
                        <Text style={[s.branchBtnTxt, { color: COLORS.white, fontFamily: FONTS.family.semiBold }]}>Get Directions</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {/* Working hours */}
          {/* <View style={[s.branchCard, { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle, ...SHADOWS.sm }]}>
            <View style={s.branchHead}>
              <View style={[s.branchIcon, { backgroundColor: COLORS.brand + '15' }]}>
                <Ionicons name="time-outline" size={20} color={COLORS.brand} />
              </View>
              <Text style={[s.branchName, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>Working Hours</Text>
            </View>
            <Text style={[s.cardValue, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
              Mon – Sat: 9 AM – 7 PM{'\n'}
            </Text>
          </View> */}

          {/* Social / store links (only those present in the API) */}
          {socialLinks.length > 0 && (
            <View style={s.socialSec}>
              <Text style={[s.socialTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]}>Connect With Us</Text>
              <View style={s.socialRow}>
                {socialLinks.map(sl => (
                  <TouchableOpacity key={sl.key} style={[s.socialBtn, { backgroundColor: sl.color + '15', borderColor: sl.color + '30' }]} onPress={() => Linking.openURL(sl.url)} activeOpacity={0.8}>
                    <Ionicons name={sl.icon} size={22} color={sl.color} />
                    <Text style={[s.socialLbl, { color: sl.color, fontFamily: FONTS.family.medium }]}>{sl.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Contact form */}
          {/* <View style={[s.formBox, { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle, ...SHADOWS.sm }]}>
            <View style={s.formHead}>
              <View style={[s.formHeadIcon, { backgroundColor: COLORS.brand + '15' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.brand} />
              </View>
              <View>
                <Text style={[s.formTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>Send a Message</Text>
                <Text style={[s.formSub, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>We'll reply within 24 hours</Text>
              </View>
            </View>

            {sent ? (
              <View style={[s.sentBox, { backgroundColor: COLORS.success + '12', borderColor: COLORS.success + '30' }]}>
                <Ionicons name="checkmark-circle" size={36} color={COLORS.success} />
                <Text style={[s.sentTitle, { color: COLORS.success, fontFamily: FONTS.family.bold }]}>Message Sent!</Text>
                <Text style={[s.sentSub, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
                  Thank you for reaching out. We'll get back to you soon.
                </Text>
              </View>
            ) : (
              <>
                <FormField label="Your Name *" icon="person-outline" value={cName} placeholder="Full name" onChangeText={setCName} colors={COLORS} fonts={FONTS} />
                <FormField label="Email *" icon="mail-outline" value={cEmail} placeholder="your@email.com" onChangeText={setCEmail} keyboardType="email-address" colors={COLORS} fonts={FONTS} />
                <FormField label="Phone" icon="call-outline" value={cPhone} placeholder="Mobile number" onChangeText={setCPhone} keyboardType="phone-pad" colors={COLORS} fonts={FONTS} />
                <FormField label="Message *" icon="chatbubble-outline" value={cMessage} placeholder="How can we help you?" onChangeText={setCMessage} multiline colors={COLORS} fonts={FONTS} />
                <TouchableOpacity
                  style={[s.sendBtn, { backgroundColor: isFormValid ? COLORS.brand : COLORS.borderSubtle, ...(isFormValid ? SHADOWS.sm : {}) }]}
                  onPress={handleSend} disabled={!isFormValid} activeOpacity={0.85}
                >
                  <Ionicons name="send-outline" size={18} color={isFormValid ? COLORS.white : COLORS.contentMuted} />
                  <Text style={[s.sendBtnTxt, { color: isFormValid ? COLORS.white : COLORS.contentMuted, fontFamily: FONTS.family.bold }]}>
                    Send Message
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View> */}

          {/* FAQ teaser */}
          <TouchableOpacity
            style={[s.faqCard, { backgroundColor: COLORS.brand + '08', borderColor: COLORS.brand + '25' }]}
            onPress={() => navigation.navigate('Faq')}
            activeOpacity={0.8}
          >
            <Ionicons name="help-circle-outline" size={28} color={COLORS.brand} />
            <View style={{ flex: 1 }}>
              <Text style={[s.faqTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]}>Have more questions?</Text>
              <Text style={[s.faqSub, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>Check our FAQ or visit a branch near you.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.brand} />
          </TouchableOpacity>

          <PoweredByFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:   { flex: 1 },
  content:     { paddingTop: 20, paddingBottom: 40 },
  pageHeader:  { marginBottom: 20 },
  pageTitle:   { fontSize: 28, letterSpacing: -0.5 },
  pageSub:     { fontSize: 14, marginTop: 4, opacity: 0.7 },
  // map
  mapBox:      { borderRadius: 16, borderWidth: 1, paddingVertical: 28, alignItems: 'center', marginBottom: 20 },
  mapPin:      { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  mapName:     { fontSize: 16, marginBottom: 4 },
  mapAddr:     { fontSize: 13, marginBottom: 14, opacity: 0.7 },
  mapBtn:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, gap: 6 },
  mapBtnTxt:   { fontSize: 13 },
  // branches (company list)
  branchSec:    { marginBottom: 16 },
  sectionHead:  { fontSize: 16, marginBottom: 12 },
  branchCard:   { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  branchHead:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  branchIcon:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  branchName:   { fontSize: 15, flex: 1 },
  branchRow:    { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 },
  branchRowIcon:{ marginRight: 10, marginTop: 1 },
  branchRowTxt: { flex: 1, fontSize: 13, lineHeight: 19 },
  branchBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 12 },
  branchBtnTxt: { fontSize: 13 },
  // cards
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  card:        { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14 },
  cardIcon:    { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardLabel:   { fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  cardValue:   { fontSize: 13, lineHeight: 19 },
  cardAction:  { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 4, paddingTop: 8, borderTopWidth: 1 },
  cardActionTxt:{ fontSize: 12 },
  // social
  socialSec:   { marginBottom: 24 },
  socialTitle: { fontSize: 16, marginBottom: 12 },
  socialRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  socialBtn:   { width: '22%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1, gap: 6 },
  socialLbl:   { fontSize: 10 },
  // form
  formBox:     { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 16 },
  formHead:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  formHeadIcon:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  formTitle:   { fontSize: 16 },
  formSub:     { fontSize: 12, opacity: 0.7 },
  sendBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  sendBtnTxt:  { fontSize: 15 },
  sentBox:     { borderRadius: 12, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8 },
  sentTitle:   { fontSize: 18 },
  sentSub:     { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  // faq
  faqCard:     { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  faqTitle:    { fontSize: 14, marginBottom: 2 },
  faqSub:      { fontSize: 12, opacity: 0.7 },
});
