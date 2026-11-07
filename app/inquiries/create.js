import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { inquiriesApi } from '@/lib/api/api';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';

const INQUIRY_TYPES = [
  { id: 'GENERAL', name: '일반 문의' },
  { id: 'TECHNICAL', name: '기술 문의' },
  { id: 'FEATURE_REQUEST', name: '기능 요청' },
  { id: 'BUG_REPORT', name: '버그 신고' },
  { id: 'ACCOUNT', name: '계정 문의' },
];

const INQUIRY_TYPE_IDS = new Set(INQUIRY_TYPES.map((t) => t.id));

export default function InquiryCreateScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const initialType = useMemo(() => {
    const raw = Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type;
    if (raw && INQUIRY_TYPE_IDS.has(String(raw))) return String(raw);
    return 'GENERAL';
  }, [searchParams.type]);

  const initialTitle = useMemo(() => {
    const raw = Array.isArray(searchParams.title) ? searchParams.title[0] : searchParams.title;
    if (!raw || typeof raw !== 'string') return '';
    try {
      return decodeURIComponent(raw).slice(0, 200);
    } catch {
      return String(raw).slice(0, 200);
    }
  }, [searchParams.title]);

  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState('');
  const [type, setType] = useState(initialType);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setType(initialType);
  }, [initialType]);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  const validate = () => {
    const next = {};
    if (!title?.trim()) next.title = '제목을 입력해주세요.';
    if (!content?.trim()) next.content = '내용을 입력해주세요.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || submitting) return;
    setSubmitting(true);
    setErrors({});
    try {
      await inquiriesApi.createInquiry({
        title: title.trim(),
        content: content.trim(),
        type,
      });
      router.replace('/inquiries');
    } catch (e) {
      setErrors({ general: e?.message || '문의 등록에 실패했습니다.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScreenHeader title="문의하기" />
        <View style={styles.centerBlock}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="문의하기" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>문의 유형과 내용을 입력해주세요.</Text>

          <Text style={styles.label}>문의 유형</Text>
          <View style={styles.typeRow}>
            {INQUIRY_TYPES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setType(t.id)}
                style={[
                  styles.typeChip,
                  type === t.id && styles.typeChipActive,
                ]}
              >
                <Text style={[styles.typeChipText, type === t.id && styles.typeChipTextActive]}>
                  {t.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Input
            label="제목"
            value={title}
            onChangeText={setTitle}
            placeholder="문의 제목을 입력하세요"
            error={errors.title}
            required
          />

          <View style={styles.field}>
            <Text style={styles.label}>
              내용 <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="문의 내용을 자세히 입력해주세요."
              multiline
              numberOfLines={6}
              style={[styles.textArea, errors.content && styles.inputError]}
              placeholderTextColor={colors.neutral[400]}
              textAlignVertical="top"
            />
            {errors.content ? <Text style={styles.errorText}>{errors.content}</Text> : null}
          </View>

          {errors.general ? <Text style={styles.errorBlock}>{errors.general}</Text> : null}

          <Button
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            disabled={submitting}
            loading={submitting}
          >
            {submitting ? '등록 중...' : '문의 등록'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: base.safeAreaNeutral,
  flex: { flex: 1 },
  container: base.containerLg,
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    ...base.textSmMuted,
    marginBottom: tokens.spacing.md,
  },
  label: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[700],
    marginBottom: tokens.spacing.xs,
  },
  required: {
    color: colors.error[500],
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: tokens.spacing.sm2,
  },
  typeChip: {
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.xs,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: colors.white,
  },
  typeChipActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  typeChipText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
  },
  typeChipTextActive: {
    color: colors.primary[700],
    fontWeight: tokens.fontWeight.semibold,
  },
  textArea: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.padding.sm,
    paddingVertical: tokens.padding.sm,
    fontSize: tokens.font.base,
    color: colors.neutral[900],
    minHeight: 120,
  },
  inputError: {
    borderColor: colors.error[500],
  },
  errorText: {
    fontSize: tokens.font.sm,
    color: colors.error[600],
    marginTop: tokens.spacing.xxs,
  },
  errorBlock: {
    fontSize: tokens.font.sm,
    color: colors.error[600],
    marginBottom: tokens.spacing.sm2,
  },
});
