import LoginPage from './pages/LoginPage/LoginPage'
import { MessageProvider } from './context/MessageContext'
function App() {
  return (
    <main>
      <MessageProvider>
        <LoginPage />
      </MessageProvider>
    </main>
  )
}

export default App
