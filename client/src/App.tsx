import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Gallery from './pages/Gallery';
import ComponentDetail from './pages/ComponentDetail';
import Upload from './pages/Upload';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/component/:id" element={<ComponentDetail />} />
        <Route path="/upload" element={<Upload />} />
      </Routes>
    </Layout>
  );
}
