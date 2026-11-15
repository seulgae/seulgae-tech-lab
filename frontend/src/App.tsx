import GameCanvas from './components/GameCanvas'
import './App.css'

/**
 * 연구소 게임 화면을 배치하는 최상위 React 컴포넌트이다.
 *
 * @author seulgae
 * @version 1.0, 애플리케이션 화면 구성 문서화
 * @see "None"
 * @returns 게임 화면을 포함한 메인 영역
 */
function App() {
  return (
    <main className="game-page">
      <GameCanvas />
    </main>
  )
}

export default App
