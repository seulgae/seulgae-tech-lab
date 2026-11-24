/**
 * 슬개 연구소 유즈맵 SDK. 맵은 sandbox iframe에서 실행되고, 이 SDK(postMessage)로만 플랫폼과 대화한다.
 *
 *   SeulgaeUseMap.onInit(({ me, hostId, players, seed, isHost }) => { ... })  // 게임 시작 정보
 *   SeulgaeUseMap.onMessage((data, from) => { ... })                          // 같은 방 다른 사람이 보낸 값
 *   SeulgaeUseMap.send(data)                                                  // 같은 방 다른 사람에게 보내기(1KB 이하, 1초 40개)
 *   SeulgaeUseMap.end({ win: true, score: 10 })                               // 게임 끝(방장만 반영)
 *
 * 판정은 방장(isHost)이 한다: 방장이 상태를 계산해 send로 나눠 주고, 나머지는 입력만 보낸다.
 *
 * @author 길태형
 * @version 1.0, 유즈맵 플랫폼
 */
(function () {
  var SOURCE = 'seulgae-usemap'
  var initHandlers = [], messageHandlers = [], info = null

  window.addEventListener('message', function (event) {
    var message = event.data
    if (!message || message.source !== SOURCE || event.source !== window.parent) return
    if (message.type === 'init') {
      info = { me: message.me, hostId: message.hostId, players: message.players, seed: message.seed, isHost: message.me.id === message.hostId }
      initHandlers.forEach(function (handler) { handler(info) })
    } else if (message.type === 'message') {
      messageHandlers.forEach(function (handler) { handler(message.data, message.from) })
    }
  })

  function post(message) { message.source = SOURCE; window.parent.postMessage(message, '*') }

  window.SeulgaeUseMap = {
    onInit: function (handler) { initHandlers.push(handler); if (info) handler(info) },
    onMessage: function (handler) { messageHandlers.push(handler) },
    send: function (data) { post({ type: 'send', data: data }) },
    end: function (result) { post({ type: 'end', result: result || {} }) },
    /** 시작 정보를 받은 뒤 같은 값을 돌려준다(아직이면 null) */
    info: function () { return info },
    /** seed로 만든 난수(모두 같은 순서를 얻는다) */
    random: function (seed) {
      var state = (seed >>> 0) || 1
      return function () { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) % 1000000) / 1000000 }
    },
  }
  /* 맵 준비 완료를 알리면 플랫폼이 init을 보낸다. */
  post({ type: 'ready' })
})()
