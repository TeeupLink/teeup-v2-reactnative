import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatBirthdateForApi } from '@/lib/util/meetingUtils';
import { colors } from '@/styles/colors';
import { tokens } from '@/styles/style';

import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';

const formationModeOptions = [
  { value: 'GENDER_SEPARATED_HANDICAP', label: '성별 분리 + 핸디캡 기준' },
  { value: 'GENDER_SEPARATED_PREVIOUS_RECORD', label: '성별 분리 + 직전대회 성적 기준' },
  { value: 'GENDER_SEPARATED_RANDOM', label: '성별 분리 + 랜덤' },
  { value: 'GENDER_MIXED_HANDICAP', label: '성별 혼합 + 핸디캡 기준' },
  { value: 'GENDER_MIXED_PREVIOUS_RECORD', label: '성별 혼합 + 직전대회 성적 기준' },
  { value: 'GENDER_MIXED_RANDOM', label: '성별 혼합 + 랜덤' },
];

function normalizeFormationMode(value) {
  if (value === 'GENDER_SEPARATED') return 'GENDER_SEPARATED_HANDICAP';
  if (value === 'MIXED') return 'GENDER_MIXED_HANDICAP';
  return value || 'GENDER_MIXED_HANDICAP';
}

export default function TeamFormationModal({
  isOpen,
  visible,
  onClose,
  onFormTeams,
  meeting,
  participants = [],
  processing,
  onOpenBatch,
}) {
  const isVisible = visible ?? isOpen;
  const [formationMode, setFormationMode] = useState(normalizeFormationMode(meeting?.team_formation_mode));
  const [teamSize, setTeamSize] = useState(String(meeting?.team_size || 4));
  const [guideModalOpen, setGuideModalOpen] = useState(false);

  const guests = useMemo(
    () => (Array.isArray(participants) ? participants.filter((p) => p?.is_guest || p?.guest_id) : []),
    [participants]
  );

  if (!isVisible) return null;

  const handleSubmit = () => {
    if (processing) return;
    const invalidGuest = guests.find((g) => {
      const raw = String(g.birthdate || '').trim().replace(/\D/g, '');
      return raw.length === 8 && !formatBirthdateForApi(g.birthdate);
    });
    if (invalidGuest) {
      Alert.alert('확인', '게스트 생년월일을 확인해주세요. (1900년~올해, 올바른 월·일)');
      return;
    }
    setGuideModalOpen(true);
  };

  const handleCloseGuideModal = () => {
    setGuideModalOpen(false);
  };

  const handleConfirmGuideModal = () => {
    setGuideModalOpen(false);
    if (onClose) {
      onClose();
    }
    if (onFormTeams) {
      onFormTeams({
        formation_mode: formationMode,
        team_size: Number(teamSize),
        preview: true,
      });
    }
  };

  return (
    <>
      <Modal
        maxContentWidth={tokens.layout.formationModalMaxPreferred}
        /* 안내 모달을 띄울 때는 이쪽을 내린다. iOS 는 모달 위에 모달을
           띄우면 아무 일도 일어나지 않는다. */
        visible={isVisible && !guideModalOpen}
        title="팀 편성"
        onClose={onClose}
        footer={(
          <View style={styles.footerRow}>
            {onOpenBatch ? (
              <Button size="sm" variant="outline" style={styles.footerButton} onPress={onOpenBatch}>
                일괄 비교
              </Button>
            ) : null}
            <Button size="sm" style={styles.footerButton} onPress={handleSubmit}>
              {processing ? '팀 편성 중...' : '팀 편성 시작'}
            </Button>
          </View>
        )}
      >
        <Text style={styles.sectionTitle}>편성 조건</Text>
        <View style={styles.modeGrid}>
          {formationModeOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setFormationMode(option.value)}
              style={({ pressed }) => [
                styles.modeChip,
                formationMode === option.value && styles.modeChipActive,
                pressed && styles.modeChipPressed,
              ]}
            >
              <Text style={[styles.modeChipText, formationMode === option.value && styles.modeChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Input
          label="팀 인원"
          value={teamSize}
          onChangeText={setTeamSize}
          keyboardType="number-pad"
          placeholder="예: 4"
        />
      </Modal>

      <Modal
        maxContentWidth={tokens.layout.formationModalMaxPreferred}
        visible={guideModalOpen}
        title="편성이 완료되었습니다."
        onClose={handleCloseGuideModal}
        containerStyle={styles.guideModalCard}
        footer={(
          <View style={styles.footerRow}>
            <Button size="sm" style={styles.footerButton} onPress={handleConfirmGuideModal}>
              확인
            </Button>
          </View>
        )}
      >
        <Text style={styles.guideText}>결과를 확인하시고 팀 편성 확정 버튼을 눌러주세요.</Text>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: tokens.font.md,
    fontWeight: tokens.fontWeight.bold,
    color: colors.neutral[900],
    marginBottom: tokens.spacing.xs2,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: tokens.spacing.sm2,
  },
  modeChip: {
    paddingHorizontal: tokens.padding.base,
    paddingVertical: tokens.padding.xs2,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.white,
  },
  modeChipActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  modeChipPressed: {
    opacity: 0.8,
  },
  modeChipText: {
    fontSize: tokens.font.xs,
    color: colors.neutral[600],
  },
  modeChipTextActive: {
    color: colors.primary[700],
    fontWeight: tokens.fontWeight.semibold,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerButton: {
    flex: 1,
  },
  guideModalCard: {
    alignSelf: 'center',
  },
  guideText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
    lineHeight: 20,
  },
});
