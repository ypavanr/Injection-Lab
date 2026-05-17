import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { PublicLayout } from './components/layout/PublicLayout';
import { AdminLayout } from './components/layout/AdminLayout';

import { Home } from './pages/public/Home';
import { PostView } from './pages/public/PostView';
import { Search } from './pages/public/Search';
import { AuthorPage } from './pages/public/AuthorPage';

import { Login } from './pages/auth/Login';

import { Dashboard } from './pages/admin/Dashboard';
import { PostsList } from './pages/admin/PostsList';
import { PostEditor } from './pages/admin/PostEditor';
import { MediaLibrary } from './pages/admin/MediaLibrary';
import { CommentsModeration } from './pages/admin/CommentsModeration';
import { Settings } from './pages/admin/Settings';
import { UsersList } from './pages/admin/UsersList';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/post/:id" element={<PostView />} />
          <Route path="/search" element={<Search />} />
          <Route path="/author/:id" element={<AuthorPage />} />
        </Route>

        {/* Auth */}
        <Route path="/admin/login" element={<Login />} />

        {/* Admin Routes — protected by AdminLayout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="posts" element={<PostsList />} />
          <Route path="editor" element={<PostEditor />} />
          <Route path="editor/:id" element={<PostEditor />} />
          <Route path="media" element={<MediaLibrary />} />
          <Route path="comments" element={<CommentsModeration />} />
          <Route path="users" element={<UsersList />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
