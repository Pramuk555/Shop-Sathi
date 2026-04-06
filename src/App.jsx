import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AppRoutes from './AppRoutes'

function App() {
  return (
    <BrowserRouter>
      {/* 
        ShopProvider could wrap here later if needed.
        Currently wrapping with AuthProvider.
      */}
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
