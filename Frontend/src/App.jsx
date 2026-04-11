import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProfilePage from './pages/ProfilePage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/"         element={<HomePage />} />
      {/* <Route path="/login"    element={<LoginPage />} />
      <Route path="/signup"   element={<SignupPage />} />
      <Route path="/profile"  element={<ProfilePage />} />
      <Route path="/cart"     element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} /> */}
    </Routes>
  )
}

export default App