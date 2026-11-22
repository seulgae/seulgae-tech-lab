import { useEffect, useState } from 'react'
import type MultiplayerClient from '../../multiplayer/MultiplayerClient'
import { inventoryStore, useInventory } from '../../inventory/inventoryStore'
import { tradeMessage } from '../../inventory/tradeMessages'
import { fishPrice } from '../../inventory/fishPrices'
import { FISH_COLORS } from '../../../game/rooms/fishingLogic'
import { playSfx } from '../../../audio/AudioManager'

/**
 * 폰 물고기 보관함 앱(예전 가방): 낚은 물고기를 보고, 바닥에 버리거나 회의실에서 교환한다.
 *
 * @author seulgae
 * @version 1.0, 폰 앱(물고기 보관함)
 * @see "None"
 * @param props 멀티플레이 클라이언트(버리기·교환 전송)
 * @returns 물고기 보관함 화면
 */
export default function FishBoxApp({ client }: { client: () => MultiplayerClient | null }) {
  const inventory = useInventory()
  const [message, setMessage] = useState<string | null>(null)
  /** 교환할 내 아이템(고르면 같은 방 연구원 목록이 열린다) */
  const [trading, setTrading] = useState<string | null>(null)
  const online = client()?.isOnline() ?? false
  const others = online ? client()!.roomPlayers() : []

  useEffect(() => client()?.subscribe({ tradeStatus: status => {
    if (status.status === 'sent') setMessage('교환을 신청했어요. 상대가 고르면 바로 맞바꿔요.')
    else setMessage(tradeMessage(status.status, status.reason))
    if (status.status === 'accepted') void inventoryStore.refresh()
  } }), [client])

  const offer = (itemId: string, playerId: string) => {
    if (client()?.offerTrade(playerId, itemId)) { setTrading(null); playSfx('click', { volume: 0.6 }) }
    else setMessage('회의실에 연결돼 있을 때만 교환할 수 있어요.')
  }

  const drop = (id: string, name: string) => {
    if (client()?.dropItem(id)) { playSfx('click', { volume: 0.6 }); setMessage(`${name}을(를) 바닥에 내려놓았어요. 누구나 E로 주울 수 있어요.`) }
    else setMessage('연결이 끊겨 버릴 수 없어요.')
  }

  return (
    <div className="phone-app-body">
      <p className="phone-muted">{inventory.items.length}마리 보관 중 · 값은 저녁 6시부터 포장마차에서 받아요{online ? ' · 회의실에서는 교환도 돼요' : ''}</p>
      {message && <p className="phone-note" role="status">{message}</p>}
      {inventory.items.length === 0 && <p className="phone-note">아직 비어 있어요. 바깥 강가 데크에서 물고기를 낚아 보세요.</p>}
      <ul className="phone-fish-list">
        {inventory.items.map(item => (
          <li key={item.id}>
            <span className="inventory-fish" style={{ background: `#${(FISH_COLORS[item.name] ?? 0xffffff).toString(16).padStart(6, '0')}` }} aria-hidden="true" />
            <span className="phone-fish-name"><strong>{item.name}</strong>{item.sizeCm && <small>{item.sizeCm}cm · 약 {fishPrice(item.name, item.sizeCm)}원</small>}</span>
            <span className="phone-row-actions">
              <button type="button" onClick={() => drop(item.id, item.name)}>버리기</button>
              {online && <button type="button" aria-expanded={trading === item.id} onClick={() => setTrading(trading === item.id ? null : item.id)}>교환</button>}
            </span>
            {trading === item.id && (
              <div className="trade-targets" role="group" aria-label="교환할 연구원">
                {others.length === 0 && <small>회의실에 다른 연구원이 없어요.</small>}
                {others.map(player => <button type="button" key={player.id} onClick={() => offer(item.id, player.id)}>{player.nickname}</button>)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
