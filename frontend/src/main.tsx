/**
 * StrictMode를 적용해 React 애플리케이션을 루트 DOM에 연결하는 진입 모듈이다.
 *
 * @author seulgae
 * @version 1.0, React 진입 모듈의 역할 문서화
 * @see "None"
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
