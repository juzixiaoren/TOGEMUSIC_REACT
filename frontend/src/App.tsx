import { MessageProvider } from './context/MessageContext'
import { RouterProvider } from 'react-router-dom'
import { router } from './router/routes'
function App() {
  return (
    <main>
      <MessageProvider>
        <RouterProvider router={router} />
      </MessageProvider>
    </main>
  )
}

export default App
