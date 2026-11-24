/**
 * 협동 버그 잡기(예제 유즈맵). 오른쪽에서 몰려오는 버그를 모두 함께 눌러 잡아 90초 동안 왼쪽 서버를 지킨다.
 * 방장이 판정한다: 버그를 만들고 움직이고(50ms), 상태를 0.1초마다 나눠 주고, 잡기 요청을 처리한다.
 * 나머지는 받은 상태를 그리고, 누른 버그 번호만 보낸다.
 *
 * 메시지(1KB 이하로 짧게):
 *   방장 → 모두  { k: 's', t: 남은 초, hp, b: [[id, x, y], ...], sc: [사람별 잡은 수] }
 *   누구 → 방장  { k: 'h', id: 버그 id }
 *   방장 → 모두  { k: 'e', win, score }
 *
 * @author 길태형
 * @version 1.0, 유즈맵 플랫폼 예제 맵
 */
(function () {
  var canvas = document.getElementById('field'), ctx = canvas.getContext('2d')
  var W = 640, H = 360, SERVER_X = 56, DURATION = 90, MAX_HP = 20, MAX_BUGS = 30, RADIUS = 16
  var me = null, players = [], isHost = false, hostId = null
  var state = { t: DURATION, hp: MAX_HP, b: [], sc: [] }
  var pops = [], over = null

  /* ---------- 방장 판정 ---------- */
  var rand = Math.random, nextId = 1, spawnIn = 0, startedAt = 0, lastSent = 0, bugs = []

  function hostTick() {
    var now = performance.now(), elapsed = (now - startedAt) / 1000
    if (over) return
    spawnIn -= 0.05
    /* 시간이 갈수록 더 자주, 더 빨리. 사람이 많으면 조금 더 많이 */
    if (spawnIn <= 0 && bugs.length < MAX_BUGS) {
      bugs.push({ id: nextId++, x: W + 10, y: 30 + rand() * (H - 60), v: 40 + elapsed * 0.9 + rand() * 30 })
      spawnIn = Math.max(0.25, 1.1 - elapsed * 0.01) / (1 + (players.length - 1) * 0.35)
    }
    for (var i = bugs.length - 1; i >= 0; i--) {
      bugs[i].x -= bugs[i].v * 0.05
      if (bugs[i].x <= SERVER_X) { bugs.splice(i, 1); state.hp -= 1 }
    }
    state.t = Math.max(0, Math.ceil(DURATION - elapsed))
    state.b = bugs.map(function (bug) { return [bug.id, Math.round(bug.x), Math.round(bug.y)] })
    if (state.hp <= 0 || state.t <= 0) finish(state.hp > 0)
    else if (now - lastSent >= 100) { lastSent = now; SeulgaeUseMap.send({ k: 's', t: state.t, hp: state.hp, b: state.b, sc: state.sc }) }
  }

  function squash(id, who) {
    for (var i = 0; i < bugs.length; i++) {
      if (bugs[i].id !== id) continue
      pops.push({ x: bugs[i].x, y: bugs[i].y, at: performance.now() })
      bugs.splice(i, 1)
      state.sc[who] = (state.sc[who] || 0) + 1
      return
    }
  }

  function finish(win) {
    var score = state.sc.reduce(function (sum, n) { return sum + (n || 0) }, 0)
    over = { win: win, score: score }
    SeulgaeUseMap.send({ k: 'e', win: win, score: score })
    setTimeout(function () { SeulgaeUseMap.end({ win: win, score: score }) }, 2500)
  }

  /* ---------- 입력 ---------- */
  canvas.addEventListener('pointerdown', function (event) {
    if (!me || over) return
    var rect = canvas.getBoundingClientRect()
    var x = (event.clientX - rect.left) / rect.width * W, y = (event.clientY - rect.top) / rect.height * H
    var best = null, bestD = RADIUS + 6
    state.b.forEach(function (bug) { var d = Math.hypot(bug[1] - x, bug[2] - y); if (d < bestD) { best = bug; bestD = d } })
    if (!best) return
    if (isHost) squash(best[0], indexOf(me.id))
    else { SeulgaeUseMap.send({ k: 'h', id: best[0] }); pops.push({ x: best[1], y: best[2], at: performance.now() }) }
  })

  function indexOf(id) { for (var i = 0; i < players.length; i++) if (players[i].id === id) return i; return 0 }

  /* ---------- 받기 ---------- */
  SeulgaeUseMap.onMessage(function (data, from) {
    if (!data || typeof data !== 'object') return
    if (isHost && data.k === 'h' && typeof data.id === 'number') squash(data.id, indexOf(from))
    if (!isHost && data.k === 's' && from === hostId) state = { t: data.t, hp: data.hp, b: Array.isArray(data.b) ? data.b : [], sc: Array.isArray(data.sc) ? data.sc : [] }
    if (!isHost && data.k === 'e' && from === hostId) over = { win: !!data.win, score: data.score | 0 }
  })

  SeulgaeUseMap.onInit(function (info) {
    me = info.me; players = info.players; isHost = info.isHost; hostId = info.hostId
    rand = SeulgaeUseMap.random(info.seed)
    state.sc = players.map(function () { return 0 })
    if (isHost) { startedAt = performance.now(); setInterval(hostTick, 50) }
  })

  /* ---------- 그리기 ---------- */
  var COLORS = ['#f472b6', '#38bdf8', '#4ade80', '#ffd23f', '#a78bfa', '#fb923c', '#f87171', '#2dd4bf']
  function draw() {
    ctx.fillStyle = '#0b0618'; ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = 'rgba(167,139,250,.12)'
    for (var gx = 0; gx < W; gx += 32) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke() }
    /* 서버 */
    ctx.fillStyle = '#1e293b'; ctx.fillRect(8, 40, SERVER_X - 16, H - 80)
    for (var r = 0; r < 8; r++) { ctx.fillStyle = state.hp > MAX_HP * (r / 8) ? '#4ade80' : '#7f1d1d'; ctx.fillRect(16, 56 + r * 32, SERVER_X - 32, 18) }
    /* 버그 */
    ctx.font = '24px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    state.b.forEach(function (bug) { ctx.fillText('🐛', bug[1], bug[2]) })
    /* 잡은 자리 */
    var now = performance.now()
    pops = pops.filter(function (pop) { return now - pop.at < 400 })
    pops.forEach(function (pop) { ctx.globalAlpha = 1 - (now - pop.at) / 400; ctx.fillText('💥', pop.x, pop.y); ctx.globalAlpha = 1 })
    /* 상단 정보 */
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffd23f'
    ctx.fillText('남은 시간 ' + state.t + '초   서버 HP ' + Math.max(0, state.hp) + '/' + MAX_HP, 70, 18)
    ctx.textAlign = 'right'
    players.forEach(function (player, i) {
      ctx.fillStyle = COLORS[i % COLORS.length]
      ctx.fillText(player.nickname + ' ' + (state.sc[i] || 0), W - 10, 18 + i * 16)
    })
    if (!me) banner('게임을 불러오는 중…')
    else if (over) banner(over.win ? '🎉 서버를 지켰어요! 잡은 버그 ' + over.score : '💥 서버가 다운됐어요… 잡은 버그 ' + over.score)
    requestAnimationFrame(draw)
  }
  function banner(text) {
    ctx.fillStyle = 'rgba(11,6,24,.75)'; ctx.fillRect(0, H / 2 - 28, W, 56)
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, W / 2, H / 2)
  }
  draw()
})()
