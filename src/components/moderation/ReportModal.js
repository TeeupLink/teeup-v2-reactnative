import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import SelectableChip from '@/components/ui/SelectableChip';
import { moderationApi } from '@/lib/api/api';
import { colors } from '@/styles/colors';
import { tokens } from '@/styles/style';

export const REPORT_REASONS = [
  { id: 'SPAM', label: '스팸·광고' },
  { id: 'ABUSE', label: '욕설·비방·괴롭힘' },
  { id: 'INAPPROPRIATE', label: '부적절한 콘텐츠' },
  { id: 'FRAUD', label: '사기·허위 정보' },
  { id: 'PRIVACY', label: '개인정보 노출' },
  { id: 'OTHER', label: '기타' },
];

const TARGET_LABEL = {
  CLUB: '클럽',
  MEETING: '모임',
  CLUB_NOTICE: '공지',
  REGULATION: '규정',
  USER: '사용자',
};

/**
 * 콘텐츠·사용자 신고 모달.
 * targetType: CLUB | MEETING | CLUB_NOTICE | REGULATION | USER
 */
export default function ReportModal({ visible, targetType, targetId, targetName, onClose, onReported }) {
  const [reason, setReason] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setDescription('');
      setIsSubmitting(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!reason || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await moderationApi.reportContent({
        targetType,
        targetId,
        reason,
        description: description.trim(),
      });
      onClose?.();
      Alert.alert(
        '신고가 접수되었습니다',
        '운영진이 24시간 이내에 확인하여 조치합니다. 신고해 주셔서 감사합니다.',
      );
      onReported?.();
    } catch (e) {
      Alert.alert('신고 실패', e?.message || '신고 접수 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const label = TARGET_LABEL[targetType] || '콘텐츠';

  return (
    <Modal
      visible={visible}
      title={`${label} 신고`}
      onClose={onClose}
      closeOnBackdropPress
      footer={(
        <View style={styles.footer}>
          <Button variant="outline" size="md" onPress={onClose} style={styles.footerBtn}>
            취소
          </Button>
          <Button
            size="md"
            onPress={handleSubmit}
            disabled={!reason}
            loading={isSubmitting}
            style={styles.footerBtn}
          >
            신고하기
          </Button>
        </View>
      )}
    >
      {targetName ? (
        <Text style={styles.targetName} numberOfLines={2}>{targetName}</Text>
      ) : null}
      <Text style={styles.sectionLabel}>신고 사유</Text>
      <View style={styles.chipRow}>
        {REPORT_REASONS.map((r) => (
          <SelectableChip
            key={r.id}
            label={r.label}
            selected={reason === r.id}
            onPress={() => setReason(r.id)}
            variant="soft"
          />
        ))}
      </View>
      <Text style={styles.sectionLabel}>상세 설명 (선택)</Text>
      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={setDescription}
        placeholder="어떤 점이 문제인지 알려주시면 처리에 도움이 됩니다."
        placeholderTextColor={colors.neutral[400]}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />
      <Text style={styles.hint}>
        허위 신고가 반복되면 이용이 제한될 수 있습니다.
      </Text>
    </Modal>
  );
}

const styles = StyleSheet.create({
  targetName: {
    fontSize: tokens.font.md,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[800],
    marginBottom: tokens.padding.md,
  },
  sectionLabel: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[700],
    marginBottom: tokens.padding.xs,
    marginTop: tokens.padding.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.padding.xs,
  },
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: tokens.radius.md,
    padding: tokens.padding.sm,
    fontSize: tokens.font.md,
    color: colors.neutral[900],
    backgroundColor: colors.white,
  },
  hint: {
    marginTop: tokens.padding.sm,
    fontSize: tokens.font.xs,
    color: colors.neutral[500],
  },
  footer: {
    flexDirection: 'row',
    gap: tokens.padding.sm,
  },
  footerBtn: {
    flex: 1,
  },
});
