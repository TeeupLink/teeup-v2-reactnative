import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import ScreenHeader from '@/components/ui/ScreenHeader';
import { authApi } from '@/lib/api/api';
import {
    createCloseWithdrawModalHandler,
    createConfirmTextChangeHandler,
    createConfirmWithdrawHandler,
    createSubmitWithdrawHandler,
    createToggleAgreedHandler,
} from '@/lib/handler/mypage';
import { getWithdrawValidationError } from '@/lib/util/mypageUtils';
import { colors } from '@/styles/colors';
import { base, tokens } from '@/styles/style';



export default function WithdrawScreen() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState('');

  const handleToggleAgreed = useMemo(
    () => createToggleAgreedHandler({ setAgreed }),
    [setAgreed]
  );
  const handleConfirmTextChange = useMemo(
    () => createConfirmTextChangeHandler({ setConfirmText }),
    [setConfirmText]
  );
  const handleSubmit = useMemo(
    () =>
      createSubmitWithdrawHandler({
        agreed,
        confirmText,
        setError,
        setModalOpen,
        getWithdrawValidationError,
      }),
    [agreed, confirmText, setError, setModalOpen]
  );
  const handleCloseModal = useMemo(
    () => createCloseWithdrawModalHandler({ setModalOpen }),
    [setModalOpen]
  );
  const handleWithdrawConfirm = useMemo(
    () =>
      createConfirmWithdrawHandler({
        deleteAccount: authApi.deleteAccount,
        setIsSubmitting,
        setResultMessage,
        setModalOpen,
        setError,
        router,
      }),
    [setIsSubmitting, setResultMessage, setModalOpen, setError, router]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="회원 탈퇴" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <FontAwesome5 name="exclamation-triangle" size={16} color={colors.error[600]} />
            <Text style={styles.warningTitle}>회원 탈퇴 안내</Text>
          </View>
          <Text style={styles.warningText}>• 회원 탈퇴 시 개인정보는 관련 법령에 따라 처리됩니다.</Text>
          <Text style={styles.warningText}>• 가입한 클럽, 모임, 골프 기록 및 통계 데이터는 삭제되며 복구할 수 없습니다.</Text>
          <Text style={styles.warningText}>• 법령에 따라 일부 정보는 일정 기간 보관될 수 있습니다.</Text>
        </View>

        <Card style={styles.card}>
          <Pressable onPress={handleToggleAgreed} style={styles.agreeRow}>
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed ? (
                <FontAwesome5 name="check" size={12} color={colors.white} />
              ) : null}
            </View>
            <Text style={styles.agreeText}>위 내용을 확인했으며 동의합니다.</Text>
          </Pressable>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.inputLabel}>
            확인을 위해 '회원탈퇴'를 입력하세요.<Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={handleConfirmTextChange}
            placeholder="회원탈퇴"
            style={[styles.input, error && styles.inputError]}
            placeholderTextColor={colors.neutral[400]}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </Card>

        <Button
          style={styles.withdrawButton}
          onPress={handleSubmit}
          color={colors.red[600]}
          disabled={!agreed || confirmText !== '회원탈퇴'}
        >
          회원 탈퇴
        </Button>
        {resultMessage ? <Text style={styles.successText}>{resultMessage}</Text> : null}
      </ScrollView>

      <Modal
        visible={modalOpen}
        title="회원 탈퇴 확인"
        onClose={handleCloseModal}
        footer={(
          <View style={styles.modalFooter}>
            <Button
              variant="outline"
              size="sm"
              style={[styles.modalButton, styles.modalButtonSpacing]}
              onPress={handleCloseModal}
            >
              취소
            </Button>
            <Button
              size="sm"
              style={styles.modalButton}
              onPress={handleWithdrawConfirm}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              {isSubmitting ? '처리 중...' : '탈퇴 확정'}
            </Button>
          </View>
        )}
      >
        <Text style={styles.modalText}>회원 탈퇴 후에는 모든 데이터가 삭제됩니다.</Text>
        <Text style={styles.modalText}>정말로 탈퇴하시겠습니까?</Text>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: base.tabScreenSafeArea,
  container: base.container,
  warningCard: {
    borderRadius: tokens.radius.lg,
    padding: tokens.padding.md,
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[500],
    marginBottom: tokens.spacing.md,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.xs2,
  },
  warningTitle: {
    marginLeft: tokens.spacing.xs2,
    fontSize: tokens.font.base,
    fontWeight: tokens.fontWeight.bold,
    color: colors.error[700],
  },
  warningText: {
    fontSize: tokens.font.sm,
    color: colors.error[700],
    marginTop: tokens.spacing.xxs,
  },
  card: {
    marginBottom: tokens.spacing.md,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: tokens.radius.xs,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.xs2,
  },
  checkboxChecked: {
    backgroundColor: colors.error[600],
    borderColor: colors.error[600],
  },
  agreeText: {
    fontSize: tokens.font.sm,
    color: colors.neutral[700],
  },
  inputLabel: {
    fontSize: tokens.font.sm,
    fontWeight: tokens.fontWeight.semibold,
    color: colors.neutral[700],
    marginBottom: tokens.spacing.xs2,
  },
  input: base.formInput,
  inputError: base.formInputError,
  errorText: { ...base.textSmError, marginTop: tokens.spacing.xs },
  successText: { ...base.textSmSuccess, marginTop: tokens.spacing.xs2, textAlign: 'center' },
  withdrawButton: {
    marginTop: tokens.spacing.xs2,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
  },
  modalButtonSpacing: {
    marginRight: tokens.spacing.xs2,
  },
  modalText: {
    fontSize: tokens.font.md,
    color: colors.neutral[700],
    marginBottom: tokens.spacing.xs2,
  },
  required: base.formRequired,
});
