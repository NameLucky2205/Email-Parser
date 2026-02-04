import React, { useState } from 'react'
import { Mail, BookOpen, Github } from 'lucide-react'
import { ExtractTab } from './components/ExtractTab'
import { ValidateTab } from './components/ValidateTab'
import { HistoryPanel } from './components/HistoryPanel'
import { useHistory } from './hooks/useHistory'
import type { HistoryItem, ExtractHistoryItem, ValidateHistoryItem } from './types/history'

type TabType = 'extract' | 'validate' | 'docs'

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('extract')
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null)
  const historyHook = useHistory()

  const handleSelectHistoryItem = (item: HistoryItem) => {
    setSelectedHistoryItem(item)
    if (item.type === 'extract') {
      setActiveTab('extract')
    } else {
      setActiveTab('validate')
    }
  }

  const tabs = [
    { id: 'extract' as TabType, label: 'Извлечение', icon: Mail },
    { id: 'validate' as TabType, label: 'Валидация', icon: Mail },
    { id: 'docs' as TabType, label: 'API Docs', icon: BookOpen },
  ]

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-white rounded-2xl shadow-lg">
              <Mail className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Email Parser</h1>
          <p className="text-xl text-white/90">Извлечение и валидация email адресов</p>
        </header>

        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-6">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === id
                  ? 'bg-white text-blue-600 shadow-xl scale-105'
                  : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-300">
          {activeTab === 'extract' && (
            <ExtractTab
              historyHook={historyHook}
              selectedHistoryItem={selectedHistoryItem}
              onHistoryItemRestored={() => setSelectedHistoryItem(null)}
            />
          )}
          {activeTab === 'validate' && (
            <ValidateTab
              historyHook={historyHook}
              selectedHistoryItem={selectedHistoryItem}
              onHistoryItemRestored={() => setSelectedHistoryItem(null)}
            />
          )}
          {activeTab === 'docs' && (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BookOpen className="w-7 h-7 text-blue-500" />
                API Documentation
              </h2>

              <div className="space-y-6">
                <div className="prose max-w-none">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Endpoints</h3>

                  <div className="space-y-4">
                    {[
                      { method: 'POST', endpoint: '/api/extract/text', desc: 'Извлечь email из текста' },
                      { method: 'POST', endpoint: '/api/extract/url', desc: 'Извлечь email с веб-страницы' },
                      { method: 'POST', endpoint: '/api/extract/file', desc: 'Извлечь email из файла' },
                      { method: 'POST', endpoint: '/api/validate/email', desc: 'Валидировать один email' },
                      { method: 'POST', endpoint: '/api/validate/bulk', desc: 'Валидировать множество email' },
                      { method: 'GET', endpoint: '/health', desc: 'Health check' },
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <span className={`px-3 py-1 rounded-lg font-semibold text-sm ${
                          item.method === 'POST' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.method}
                        </span>
                        <code className="flex-1 font-mono text-sm bg-gray-100 px-3 py-1 rounded">{item.endpoint}</code>
                        <span className="text-gray-600 text-sm">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <a
                    href="http://localhost:8002/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl"
                  >
                    <BookOpen className="w-5 h-5" />
                    Swagger UI
                  </a>
                  <a
                    href="http://localhost:8002/redoc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
                  >
                    <BookOpen className="w-5 h-5" />
                    ReDoc
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="text-center mt-12 text-white/80">
          <p className="flex items-center justify-center gap-2">
            Email Parser v1.0.0
            <span>•</span>
            <a
              href="https://github.com/NameLucky2205/Email-Parser"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-white transition-colors underline"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </p>
        </footer>
      </div>

      {/* History Panel */}
      <HistoryPanel
        history={historyHook.history}
        onSelectItem={handleSelectHistoryItem}
        onRemoveItem={historyHook.removeHistoryItem}
        onClearHistory={historyHook.clearHistory}
      />
    </div>
  )
}

export default App
