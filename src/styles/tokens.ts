// Apple Design System tokens — derived from DESIGN-apple.md
// 모든 씬에서 이 파일만 import한다. 디자인 변경 시 여기만 수정.

export const colors = {
  primary: '#0066cc',
  primaryFocus: '#0071e3',
  primaryOnDark: '#2997ff',
  ink: '#1d1d1f',
  body: '#1d1d1f',
  bodyOnDark: '#ffffff',
  bodyMuted: '#cccccc',
  inkMuted80: '#333333',
  inkMuted48: '#7a7a7a',
  dividerSoft: '#f0f0f0',
  hairline: '#e0e0e0',
  canvas: '#ffffff',
  canvasParchment: '#f5f5f7',
  surfacePearl: '#fafafc',
  surfaceTile1: '#272729',
  surfaceTile2: '#2a2a2c',
  surfaceTile3: '#252527',
  surfaceBlack: '#000000',
  surfaceChipTranslucent: '#d2d2d7',
  onPrimary: '#ffffff',
  onDark: '#ffffff',
  // Korean stock convention — 오르면 빨강, 내리면 파랑
  gainRed: '#d92e2e',
  gainRedOnDark: '#ff5e5e',
  lossBlue: '#1973d8',
  lossBlueOnDark: '#5aa9ff',
} as const;

// 영문은 Inter (SF Pro 대체, DESIGN-apple.md §Note on Font Substitutes), 한글은 Noto Sans KR로 글자 단위 폴백.
// CSS font-family 체인은 각 글리프마다 첫 번째 가능한 폰트를 사용하므로:
//   - 영문 → Inter (Inter가 글리프 있음)
//   - 한글 → Inter 없음 → Noto Sans KR
const fontFamily = 'Inter, "Noto Sans KR", system-ui, -apple-system, sans-serif';

// 1080p 영상에서 가독성을 위해 모든 사이즈를 1.5x 키움. letter-spacing도 비례 보정.
export const type = {
  heroDisplay: {
    fontFamily,
    fontSize: 96,
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: '-1.4px',
  },
  displayLg: {
    fontFamily,
    fontSize: 64,
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: '-0.64px',
  },
  displayMd: {
    fontFamily,
    fontSize: 52,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-1.1px',
  },
  lead: {
    fontFamily,
    fontSize: 40,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: '-0.12px',
  },
  leadAiry: {
    fontFamily,
    fontSize: 36,
    fontWeight: 300,
    lineHeight: 1.4,
    letterSpacing: '-0.36px',
  },
  tagline: {
    fontFamily,
    fontSize: 32,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '0.03px',
  },
  bodyStrong: {
    fontFamily,
    fontSize: 26,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.83px',
  },
  body: {
    fontFamily,
    fontSize: 24,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: '-0.77px',
  },
  caption: {
    fontFamily,
    fontSize: 20,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: '-0.52px',
  },
  captionStrong: {
    fontFamily,
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.52px',
  },
  finePrint: {
    fontFamily,
    fontSize: 18,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: '-0.36px',
  },
} as const;

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 17,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 80,
} as const;

export const radius = {
  none: 0,
  xs: 5,
  sm: 8,
  md: 11,
  lg: 18,
  pill: 9999,
} as const;

// 시스템 전체에서 단 하나의 그림자 — 차트 컨테이너/제품 이미지에만 사용. UI 요소 ❌
export const productShadow = '3px 5px 30px rgba(0,0,0,0.22)';
