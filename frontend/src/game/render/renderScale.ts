import type Phaser from 'phaser'

/** 게임 세계 좌표계. 서버 충돌·이동과 공유하므로 렌더 해상도와 무관하게 고정한다. */
export const WORLD_WIDTH = 800
export const WORLD_HEIGHT = 600
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
export const RENDER_ZOOM_KEY = 'renderZoom'

/** 한글이 있는 UI 글자. 글꼴마다 한글 글리프 유무가 달라 명시적으로 한글 글꼴을 앞에 둔다. */
export const UI_FONT = '"Pretendard", "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
/** 영문·숫자 위주 표시(코드 패널, 안내판). 한글이 섞여도 깨지지 않도록 한글 글꼴로 대체한다. */
export const MONO_FONT = '"Cascadia Mono", Consolas, "D2Coding", "Malgun Gothic", "Apple SD Gothic Neo", monospace'

/**
 * 캔버스 내부 해상도를 실제 기기 픽셀과 1:1로 맞추는 배율을 구한다.
 * 800px 캔버스를 CSS로 줄이면 최근접 샘플링이 픽셀 줄을 버려 한글 획이 끊긴다.
 */
export function renderZoomFor(cssWidth: number, devicePixelRatio: number) {
  if (!Number.isFinite(cssWidth) || cssWidth <= 0) return 1
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (cssWidth * ratio) / WORLD_WIDTH))
}

/** 4:3 비율을 유지한 정수 캔버스 크기와, 그 크기에서 실제로 적용되는 배율 */
export function canvasSizeFor(zoom: number) {
  const width = Math.round(WORLD_WIDTH * zoom)
  return { width, height: Math.round((width * WORLD_HEIGHT) / WORLD_WIDTH), zoom: width / WORLD_WIDTH }
}

/** 장면이 공유 레지스트리에서 현재 렌더 배율을 읽는다. 테스트 대역처럼 레지스트리가 없으면 1이다. */
export function renderZoom(scene: Phaser.Scene) {
  const value = (scene as { registry?: { get?: (key: string) => unknown } }).registry?.get?.(RENDER_ZOOM_KEY)
  return typeof value === 'number' && value > 0 ? value : 1
}

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle

/** 글자 텍스처를 렌더 배율과 같은 해상도로 만들어 화면 픽셀과 1:1로 그린다. */
export function crispText(scene: Phaser.Scene, x: number, y: number, value: string, style: TextStyle) {
  return scene.add.text(x, y, value, { fontFamily: UI_FONT, ...style }).setResolution(renderZoom(scene))
}

/** 카메라 줌으로 세계 800×600을 렌더 캔버스에 맞추고, 이미 만든 글자의 해상도도 갱신한다. */
export function applyRenderZoom(scene: Phaser.Scene) {
  const zoom = renderZoom(scene)
  scene.cameras.main.setZoom(zoom).centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2)
  const visit = (objects: Phaser.GameObjects.GameObject[]) => {
    for (const object of objects) {
      if (object.type === 'Text') (object as Phaser.GameObjects.Text).setResolution(zoom)
      else if (object.type === 'Container') visit((object as Phaser.GameObjects.Container).list)
    }
  }
  visit(scene.children.list)
}
