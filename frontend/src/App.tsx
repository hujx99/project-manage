import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ContractDetailPage from './pages/ContractDetailPage';
import ContractsPage from './pages/ContractsPage';
import Dashboard from './pages/Dashboard';
import ImportsPage from './pages/ImportsPage';
import PaymentsPage from './pages/PaymentsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectsPage from './pages/ProjectsPage';

const App = () => (
  <Routes>
    <Route path="/" element={<MainLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="projects/:id" element={<ProjectDetailPage />} />
      <Route path="contracts" element={<ContractsPage />} />
      <Route path="contracts/:id" element={<ContractDetailPage />} />
      <Route path="payments" element={<PaymentsPage />} />
      <Route path="imports" element={<ImportsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
);

export default App;
