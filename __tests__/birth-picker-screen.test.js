/**
 * 생년월일 선택기 화면 동작 (iOS).
 *
 * 핸들러 단위 테스트(birth-picker.test.js)는 값이 어떻게 흐르는지만 본다.
 * 사용자가 실제로 겪은 문제는 "열면 빠져나올 수 없다" 였고 그건 화면에
 * 확인/취소가 있느냐의 문제라서, 여기서 렌더해 눌러 본다.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

jest.mock('@/lib/api/api', () => ({
  mypageApi: {
    fetchMyProfile: jest.fn(),
    fetchUserHandicap: jest.fn(),
    checkNicknameAvailability: jest.fn(),
    updateMyProfile: jest.fn(),
  },
}));

// 네이티브 선택기는 테스트 환경에서 못 띄우므로, onChange 를 바깥에서
// 부를 수 있는 가짜로 바꾼다. 스피너를 굴리는 것과 같은 효과를 낸다.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockPicker = ({ onChange, value }) => {
    MockPicker.lastOnChange = onChange;
    return React.createElement(Text, { testID: 'birth-spinner' }, String(value));
  };
  return { __esModule: true, default: MockPicker };
});

import { mypageApi } from '@/lib/api/api';
import MockPicker from '@react-native-community/datetimepicker';

import UserProfileEditForm from '../app/(tabs)/mypage/edit';

const PROFILE = {
  id: 7,
  email: 'a@b.c',
  nickname: '테스터',
  realname: '홍길동',
  phone_number: '01012345678',
  birthdate: null,
  gender: '',
  average_score: null,
  average_score_init: null,
  handicap: null,
  handicap_init: null,
};

describe('생년월일 선택기 (iOS 화면)', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'ios';
    MockPicker.lastOnChange = undefined;
    mypageApi.fetchMyProfile.mockResolvedValue({ data: PROFILE });
    mypageApi.fetchUserHandicap.mockResolvedValue({ data: null });
  });

  afterEach(() => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
  });

  const openPicker = async () => {
    render(<UserProfileEditForm />);
    await waitFor(() => expect(mypageApi.fetchMyProfile).toHaveBeenCalled());
    fireEvent.press(await screen.findByText('날짜를 선택하세요'));
    return screen.findByTestId('birth-spinner');
  };

  // 스피너를 굴린다. 네이티브 onChange 는 React 밖에서 오므로 act 로 감싼다.
  const spinTo = async (date) => {
    await act(async () => {
      MockPicker.lastOnChange({ type: 'set' }, date);
    });
  };

  it('필드를 누르면 선택기와 확인·취소가 함께 뜬다', async () => {
    await openPicker();
    // 이게 없으면 iOS 에서 선택기를 닫을 길이 없다
    expect(screen.getByText('확인')).toBeTruthy();
    expect(screen.getByText('취소')).toBeTruthy();
  });

  it('스피너를 굴려도 선택기가 닫히지 않는다', async () => {
    await openPicker();
    await spinTo(new Date(1990, 4, 17));
    expect(screen.getByTestId('birth-spinner')).toBeTruthy();
  });

  it('확인을 누르면 선택기가 닫히고 고른 날짜가 들어간다', async () => {
    await openPicker();
    await spinTo(new Date(1990, 4, 17));
    fireEvent.press(screen.getByText('확인'));

    await waitFor(() => expect(screen.queryByTestId('birth-spinner')).toBeNull());
    expect(screen.getByText('1990-05-17')).toBeTruthy();
  });

  it('취소를 누르면 닫히고 값은 그대로다', async () => {
    await openPicker();
    await spinTo(new Date(1990, 4, 17));
    fireEvent.press(screen.getByText('취소'));

    await waitFor(() => expect(screen.queryByTestId('birth-spinner')).toBeNull());
    expect(screen.getByText('날짜를 선택하세요')).toBeTruthy();
  });

  it('확인하고 다시 열면 고른 날짜에서 시작한다', async () => {
    await openPicker();
    await spinTo(new Date(1990, 4, 17));
    fireEvent.press(screen.getByText('확인'));
    await waitFor(() => expect(screen.queryByTestId('birth-spinner')).toBeNull());

    fireEvent.press(screen.getByText('1990-05-17'));
    const spinner = await screen.findByTestId('birth-spinner');
    expect(spinner.props.children).toContain('1990');
  });
});
