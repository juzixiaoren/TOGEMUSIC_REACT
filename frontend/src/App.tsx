import { MessageProvider } from './context/MessageContext'
import { DarkModeProvider } from './context/DarkModeContext'
import { RouterProvider } from 'react-router-dom'
import { router } from './router/routes'
import DarkModeToggle from './components/DarkModeToggle'

function App() {
  return (
    <main>
      <DarkModeProvider>
        <MessageProvider>
          <RouterProvider router={router} />
        </MessageProvider>
        <DarkModeToggle />
      </DarkModeProvider>
    </main>
  )
}

export default App
