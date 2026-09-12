import { Routes, Route } from 'react-router-dom'
import HomePage from '../pages/customer/HomePage.jsx'
import LoginPage from '../pages/customer/LoginPage.jsx'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  )
}

export default AppRoutes
