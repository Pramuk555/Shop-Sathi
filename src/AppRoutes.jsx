import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import AddProductPage from './pages/AddProductPage';
import NewBillPage from './pages/NewBillPage';
import BillConfirmPage from './pages/BillConfirmPage';
import UdharPage from './pages/UdharPage';
import SettingsPage from './pages/SettingsPage';

// Pages placeholders (to be created)

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        {/* We will wrap these in AppLayout later which has the BottomNav */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/add-product" element={<AddProductPage />} />
          <Route path="/new-bill" element={<NewBillPage />} />
          <Route path="/bill-confirm" element={<BillConfirmPage />} />
          <Route path="/udhar" element={<UdharPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
