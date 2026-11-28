import { useCallback, useEffect, useState } from 'react'
import './InstallBanner.css'

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'lab.install-banner-dismissed'

/**
 * 접속한 브라우저에서 사용할 수 있는 앱 설치 안내 방식을 확인한다.
 * @returns 설치 안내 방식 또는 안내 대상이 아닌 경우 null
 */
function getInstallGuide() {
  const { userAgent, maxTouchPoints } = navigator
  // 데스크톱 웹사이트로 접속한 iPad는 Mac으로 식별된다.
  if (/iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes('Macintosh') && maxTouchPoints > 1)) return 'ios'
  if (/Chrome\//.test(userAgent) && !/; wv\)|KAKAOTALK|NAVER\(inapp/.test(userAgent)) return 'browser'
  return null
}

/**
 * 설치한 앱으로 실행 중이거나 현재 탭에서 안내를 닫았는지 확인한다.
 * @returns 설치 안내를 숨길지 여부
 */
function shouldHideBanner() {
  const appNavigator = navigator as Navigator & { standalone?: boolean }
  if (appNavigator.standalone || window.matchMedia('(display-mode: standalone)').matches) return true

  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 접속 시 웹 앱 설치를 안내하고 브라우저가 지원하면 설치 확인 창을 연다.
 *
 * @author seulgae
 * @version 1.0, 브라우저별 웹 앱 설치 안내 추가
 * @see https://web.dev/articles/customize-install
 * @returns 앱 설치 안내 영역 또는 표시할 안내가 없는 경우 null
 */
export default function InstallBanner() {
  const [guide] = useState(getInstallGuide)
  const [hidden, setHidden] = useState(shouldHideBanner)
  const [showInstructions, setShowInstructions] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)

  /** 현재 탭에서 안내를 닫고 새로고침 후에도 닫힌 상태를 유지한다. */
  const dismiss = useCallback(() => {
    setHidden(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // 저장소를 사용할 수 없어도 열린 페이지에서는 안내를 닫는다.
    }
  }, [])

  useEffect(() => {
    if (hidden || !window.isSecureContext || guide === 'ios') return

    /**
     * 설치 이벤트를 보관해 사용자가 설치 버튼을 누를 때 확인 창을 열도록 한다.
     * @param event 브라우저가 제공한 설치 이벤트
     */
    function capturePrompt(event: Event) {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', capturePrompt)
    window.addEventListener('appinstalled', dismiss)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt)
      window.removeEventListener('appinstalled', dismiss)
    }
  }, [dismiss, guide, hidden])

  /** 브라우저의 설치 확인 창을 열고 설치 결과에 맞게 안내를 갱신한다. */
  async function install() {
    if (!installPrompt) return

    // 브라우저가 제공한 설치 이벤트는 한 번만 사용할 수 있다.
    setInstallPrompt(null)
    try {
      const { outcome } = await installPrompt.prompt()
      if (outcome === 'accepted') dismiss()
    } catch {
      setShowInstructions(true)
    }
  }

  if (hidden || !window.isSecureContext || (!guide && !installPrompt && !showInstructions)) return null

  return (
    <section className="install-banner" aria-labelledby="install-banner-title">
      <img className="install-banner-icon" src="/app-icon-192.png" alt="" width="40" height="40" />
      <div className="install-banner-copy">
        <h2 id="install-banner-title">슬개기술연구소 앱 설치</h2>
        <p>
          {guide === 'ios'
            ? 'Safari에서 공유 → 홈 화면에 추가를 선택하세요. ‘웹 앱으로 열기’가 보이면 켜 주세요.'
            : '앱 아이콘으로 연구소에 바로 들어올 수 있어요.'}
        </p>
        <p id="install-banner-instructions" hidden={!showInstructions}>
          브라우저 메뉴에서 ‘앱 설치’, ‘페이지를 앱으로 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.
        </p>
      </div>
      <div className="install-banner-actions">
        {guide !== 'ios' && (installPrompt ? (
          <button type="button" className="install-banner-primary" onClick={install}>앱 설치</button>
        ) : (
          <button type="button" className="install-banner-primary" aria-expanded={showInstructions}
            aria-controls="install-banner-instructions" onClick={() => setShowInstructions(!showInstructions)}>설치 방법</button>
        ))}
        <button type="button" onClick={dismiss}>나중에</button>
      </div>
    </section>
  )
}
