import { useState } from 'react';
import Login from './components/Login';
import Tab1Pipeline from './components/Tab1Pipeline';
import Tab2Tasks from './components/Tab2Tasks';

type TabType = 'pipeline' | 'tasks';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pipeline');

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">GCS Sales Snapshot</h1>
              <p className="text-gray-600 mt-1 text-sm">Pipeline & Task Performance Tracking</p>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex space-x-2 py-4">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${
                activeTab === 'pipeline'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Pipeline View
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm ${
                activeTab === 'tasks'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              Tasks
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'pipeline' && <Tab1Pipeline />}
        {activeTab === 'tasks' && <Tab2Tasks />}
      </main>

      <footer className="bg-white mt-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <p className="text-center text-gray-500 text-sm">
            © 2025 Global Citizen Solutions - Sales Snapshot Dashboard
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;