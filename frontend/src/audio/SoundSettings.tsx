import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { getAudioSettings, resetAudioSettings, subscribeAudioSettings, updateAudioSettings } from './audioSettings'
import type { AudioSettings } from './audioSettings'
import { getAudioStatus, playSfx, subscribeAudioStatus } from './AudioManager'
import './soundSettings.css'

type Volume = 'master' | 'bgm' | 'sfx' | 'ambient'
const ROWS: { key: Volume; label: string; toggle?: 'bgmOn' | 'sfxOn' | 'ambientOn' }[] = [
  { key: 'master', label: '전체 볼륨' },
  { key: 'bgm', label: '배경음악', toggle: 'bgmOn' },
  { key: 'sfx', label: '효과음', toggle: 'sfxOn' },
  { key: 'ambient', label: '환경음', toggle: 'ambientOn' },
]

/**
 * 게임 화면 오른쪽 위 사운드 설정. 바꾸는 즉시 재생 중인 소리에 반영되고 이 브라우저에 저장된다.
 * 브라우저가 소리를 막고 있으면(첫 클릭 전) 안내 문구를 보여 준다.
 *
 * @author seulgae
 * @version 1.0, 사운드 시스템
 * @see "None"
 * @returns 사운드 버튼과 설정 창
 */
export default function SoundSettings() {
  const settings = useSyncExternalStore(subscribeAudioSettings, getAudioSettings)
  const status = useSyncExternalStore(subscribeAudioStatus, getAudioStatus)
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  // 바깥을 누르거나 ESC를 누르면 닫는다.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open])

  const update = (patch: Partial<AudioSettings>) => { updateAudioSettings(patch); playSfx('click', { volume: 0.6 }) }
  const silent = settings.muted || settings.master === 0
  return (
    <div className="sound-settings" ref={rootRef}>
      <button type="button" className="sound-button" aria-expanded={open} aria-controls={panelId}
        aria-label={silent ? '사운드 설정(음소거)' : '사운드 설정'} onClick={() => { setOpen(value => !value); playSfx('click', { volume: 0.6 }) }}>
        <span aria-hidden="true">{silent ? '🔇' : '♪'}</span>
      </button>
      {open && (
        <div className="sound-panel" id={panelId} role="group" aria-label="사운드 설정">
          <div className="sound-panel-head">
            <strong>SOUND</strong>
            <label className="sound-check"><input type="checkbox" checked={settings.muted} onChange={event => update({ muted: event.target.checked })} /> 전체 음소거</label>
          </div>
          {!status.available && <p className="sound-note">이 브라우저에서는 소리를 낼 수 없어요. 게임은 그대로 즐길 수 있어요.</p>}
          {status.available && !status.unlocked && <p className="sound-note">브라우저 정책으로 아직 조용해요. 게임 화면을 한 번 클릭하면 소리가 켜져요.</p>}
          {ROWS.map(row => (
            <div className="sound-row" key={row.key}>
              <label htmlFor={`${panelId}-${row.key}`}>{row.label}</label>
              <input id={`${panelId}-${row.key}`} type="range" min={0} max={100} step={5} value={Math.round(settings[row.key] * 100)}
                disabled={settings.muted || (row.toggle ? !settings[row.toggle] : false)}
                onChange={event => updateAudioSettings({ [row.key]: Number(event.target.value) / 100 })} />
              <output htmlFor={`${panelId}-${row.key}`}>{Math.round(settings[row.key] * 100)}%</output>
              {row.toggle
                ? <label className="sound-check"><input type="checkbox" checked={settings[row.toggle]} onChange={event => update({ [row.toggle!]: event.target.checked })} /> 켜기</label>
                : <span />}
            </div>
          ))}
          <button type="button" className="sound-reset" onClick={() => { resetAudioSettings(); playSfx('click', { volume: 0.6 }) }}>기본값으로 초기화</button>
        </div>
      )}
    </div>
  )
}
