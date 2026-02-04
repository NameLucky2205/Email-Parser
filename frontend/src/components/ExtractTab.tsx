import React, { useState, useEffect } from 'react'
import { Mail, Globe, FileText, Loader2, Search, Download, CheckCircle2, XCircle, AlertTriangle, Shield } from 'lucide-react'
import { api } from '../lib/api'
import type { ExtractResponse, BulkValidationResponse, ValidationResult } from '../types'
import type { HistoryItem, ExtractHistoryItem } from '../types/history'
import { StatsCard } from './StatsCard'
import { exportEmailListToExcel, exportValidationToExcel } from '../lib/excel'

interface ExtractTabProps {
  historyHook: ReturnType<typeof import('../hooks/useHistory').useHistory>
  selectedHistoryItem: HistoryItem | null
  onHistoryItemRestored: () => void
}

export function ExtractTab({ historyHook, selectedHistoryItem, onHistoryItemRestored }: ExtractTabProps) {
  const [sourceType, setSourceType] = useState<'text' | 'url' | 'file'>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [strict, setStrict] = useState(false)
  const [deepCrawl, setDeepCrawl] = useState(false)
  const [maxDepth, setMaxDepth] = useState(2)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ExtractResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Validation states
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<BulkValidationResponse | null>(null)
  const [checkMx, setCheckMx] = useState(true)
  const [checkDisposable, setCheckDisposable] = useState(true)
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null)
  const [editedEmails, setEditedEmails] = useState<{ [index: number]: string }>({})

  // Restore results from history
  useEffect(() => {
    if (selectedHistoryItem && selectedHistoryItem.type === 'extract') {
      const extractItem = selectedHistoryItem as ExtractHistoryItem

      // Restore extraction results
      setResult(extractItem.result)
      setError(null)

      // Restore validation results if they exist
      if (extractItem.validationResult) {
        setValidationResult(extractItem.validationResult)
      } else {
        setValidationResult(null)
      }

      // Restore source information
      setSourceType(extractItem.source as 'text' | 'url' | 'file')
      if (extractItem.source === 'url') {
        setUrl(extractItem.sourceValue)
      }

      // Set current history ID to prevent creating duplicate history entries
      setCurrentHistoryId(extractItem.id)

      // Notify parent that restoration is complete
      onHistoryItemRestored()
    }
  }, [selectedHistoryItem, onHistoryItemRestored])

  const handleExtract = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setValidationResult(null)
    setCurrentHistoryId(null)

    try {
      let response: ExtractResponse
      let sourceValue = ''

      if (sourceType === 'text') {
        if (!text.trim()) throw new Error('Пожалуйста, введите текст')
        response = await api.extractFromText(text, strict)
        sourceValue = text.substring(0, 100) // первые 100 символов
      } else if (sourceType === 'url') {
        if (!url.trim()) throw new Error('Пожалуйста, введите URL')
        response = await api.extractFromUrl(url, deepCrawl, maxDepth)
        sourceValue = url
      } else {
        if (!file) throw new Error('Пожалуйста, выберите файл')
        response = await api.extractFromFile(file)
        sourceValue = file.name
      }

      setResult(response)

      // Сохранить в историю
      const historyId = historyHook.addExtractHistory(sourceType, sourceValue, response)
      setCurrentHistoryId(historyId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleValidateExtracted = async () => {
    if (!result || result.emails.length === 0) return

    setValidating(true)
    setError(null)

    try {
      const validationResponse = await api.validateBulk(result.emails, checkMx, checkDisposable)
      setValidationResult(validationResponse)
      setEditedEmails({}) // Сбросить отредактированные email

      // Обновить запись истории результатом валидации
      if (currentHistoryId) {
        historyHook.updateExtractWithValidation(currentHistoryId, validationResponse)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при валидации')
    } finally {
      setValidating(false)
    }
  }

  const handleRevalidateEdited = async () => {
    if (!validationResult || Object.keys(editedEmails).length === 0) return

    setValidating(true)
    setError(null)

    try {
      // Создать новый массив результатов с отредактированными email
      const updatedResults = [...validationResult.results]
      const emailsToRevalidate: string[] = []
      const indicesToUpdate: number[] = []

      Object.entries(editedEmails).forEach(([indexStr, email]) => {
        const index = parseInt(indexStr)
        if (email.trim()) {
          emailsToRevalidate.push(email.trim())
          indicesToUpdate.push(index)
        }
      })

      if (emailsToRevalidate.length > 0) {
        // Повторно валидировать отредактированные email
        const revalidationResponse = await api.validateBulk(emailsToRevalidate, checkMx, checkDisposable)

        // Обновить результаты
        revalidationResponse.results.forEach((newResult, i) => {
          const originalIndex = indicesToUpdate[i]
          updatedResults[originalIndex] = newResult
        })

        // Пересчитать статистику
        const valid = updatedResults.filter(r => r.valid).length
        const invalid = updatedResults.filter(r => !r.valid).length
        const disposable = updatedResults.filter(r => r.disposable?.is_disposable).length

        const updatedValidationResult: BulkValidationResponse = {
          ...validationResult,
          results: updatedResults,
          valid,
          invalid,
          disposable,
        }

        setValidationResult(updatedValidationResult)
        setEditedEmails({}) // Очистить отредактированные email

        // Обновить историю с новыми результатами
        if (currentHistoryId) {
          historyHook.updateExtractWithValidation(currentHistoryId, updatedValidationResult)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при повторной валидации')
    } finally {
      setValidating(false)
    }
  }

  const handleEmailEdit = (index: number, newEmail: string) => {
    setEditedEmails(prev => ({
      ...prev,
      [index]: newEmail
    }))
  }

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getRiskLabel = (level?: string) => {
    switch (level) {
      case 'low':
        return 'Низкий риск'
      case 'medium':
        return 'Средний риск'
      case 'high':
        return 'Высокий риск'
      default:
        return 'Неизвестно'
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Search className="w-7 h-7 text-blue-500" />
          Извлечение Email Адресов
        </h2>

        {/* Source Type Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Выберите источник:</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'text', label: 'Текст', icon: FileText },
              { value: 'url', label: 'URL', icon: Globe },
              { value: 'file', label: 'Файл', icon: Mail },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSourceType(value as any)}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  sourceType === value
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input */}
        {sourceType === 'text' && (
          <div className="space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Вставьте текст для поиска email адресов..."
              className="w-full h-40 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none resize-none"
            />
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={strict}
                onChange={(e) => setStrict(e.target.checked)}
                className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-200"
              />
              Строгая валидация
            </label>
          </div>
        )}

        {/* URL Input */}
        {sourceType === 'url' && (
          <div className="space-y-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            />
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deepCrawl}
                  onChange={(e) => setDeepCrawl(e.target.checked)}
                  className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-200"
                />
                Глубокое сканирование (crawl links)
              </label>
              {deepCrawl && (
                <div className="ml-6 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Глубина сканирования: <span className="text-blue-600 font-bold">{maxDepth}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* File Input */}
        {sourceType === 'file' && (
          <div>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Mail className="w-12 h-12 text-gray-400 mb-3" />
                <p className="mb-2 text-sm text-gray-700">
                  <span className="font-semibold">Нажмите для загрузки</span> или перетащите файл
                </p>
                <p className="text-xs text-gray-500">TXT, HTML, CSV, LOG</p>
                {file && <p className="mt-2 text-sm font-medium text-blue-600">{file.name}</p>}
              </div>
              <input
                type="file"
                accept=".txt,.html,.csv,.log"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Extract Button */}
        <button
          onClick={handleExtract}
          disabled={loading}
          className="w-full mt-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Извлечение...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Извлечь Email
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl">
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCard title="Найдено Email" value={result.count} icon={<Mail className="w-6 h-6" />} variant="success" />
            <StatsCard title="Время обработки" value={`${result.processing_time}s`} icon={<Loader2 className="w-6 h-6" />} />
            <StatsCard title="Статус" value="Успешно" icon={<Search className="w-6 h-6" />} variant="success" />
          </div>

          {/* Action Buttons */}
          {result.emails.length > 0 && !validationResult && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Действия с извлеченными email:</h3>

              {/* Validation Options */}
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkMx}
                    onChange={(e) => setCheckMx(e.target.checked)}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-200"
                  />
                  Проверить MX записи
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkDisposable}
                    onChange={(e) => setCheckDisposable(e.target.checked)}
                    className="w-4 h-4 text-blue-500 rounded focus:ring-2 focus:ring-blue-200"
                  />
                  Проверить одноразовые email
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleValidateExtracted}
                  disabled={validating}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                >
                  {validating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Валидация...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Проверить валидацию
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    const source = sourceType === 'text' ? 'Текст' : sourceType === 'url' ? url : file?.name || 'Файл'
                    exportEmailListToExcel(result, source)
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <Download className="w-5 h-5" />
                  Экспортировать список
                </button>
              </div>
            </div>
          )}

          {/* Email List */}
          {result.emails.length > 0 && !validationResult && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Найденные Email адреса:</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {result.emails.map((email, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg hover:shadow-md transition-all"
                  >
                    <Mail className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="font-medium text-gray-900">{email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation Results */}
          {validationResult && (
            <div className="space-y-6">
              {/* Validation Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatsCard title="Всего" value={validationResult.total} icon={<Mail className="w-6 h-6" />} />
                <StatsCard
                  title="Валидные"
                  value={validationResult.valid}
                  icon={<CheckCircle2 className="w-6 h-6" />}
                  variant="success"
                />
                <StatsCard
                  title="Невалидные"
                  value={validationResult.invalid}
                  icon={<XCircle className="w-6 h-6" />}
                  variant="danger"
                />
                <StatsCard
                  title="Одноразовые"
                  value={validationResult.disposable}
                  icon={<AlertTriangle className="w-6 h-6" />}
                  variant="warning"
                />
              </div>

              {/* Export Validation Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setValidationResult(null)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-semibold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <Search className="w-5 h-5" />
                  Показать список
                </button>
                {Object.keys(editedEmails).length > 0 && (
                  <button
                    onClick={handleRevalidateEdited}
                    disabled={validating}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                  >
                    {validating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Проверка...
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Проверить снова ({Object.keys(editedEmails).length})
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => exportValidationToExcel(validationResult)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
                >
                  <Download className="w-5 h-5" />
                  Экспортировать результаты
                </button>
              </div>

              {/* Validation Details */}
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Результаты валидации:</h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {validationResult.results.map((item: ValidationResult, index: number) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                        item.valid
                          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                          : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          {item.valid ? (
                            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            {!item.valid ? (
                              <div className="space-y-1">
                                <input
                                  type="email"
                                  value={editedEmails[index] ?? item.email}
                                  onChange={(e) => handleEmailEdit(index, e.target.value)}
                                  className="w-full px-3 py-2 border-2 border-red-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none font-semibold text-gray-900"
                                  placeholder="Исправьте email адрес"
                                />
                                {item.error && <p className="text-sm text-red-600">{item.error}</p>}
                              </div>
                            ) : (
                              <>
                                <p className="font-semibold text-gray-900">{item.email}</p>
                                {item.provider && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Провайдер:</span> {item.provider.provider}
                                    {item.domain && <span className="text-gray-400"> • {item.domain}</span>}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {item.valid && item.risk_level && (
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(item.risk_level)}`}>
                            {getRiskLabel(item.risk_level)}
                          </div>
                        )}
                      </div>

                      {/* Additional Info */}
                      {item.valid && item.checks && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex flex-wrap gap-2">
                            {item.checks.format && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                ✓ Формат
                              </span>
                            )}
                            {item.checks.mx && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                                ✓ MX записи
                              </span>
                            )}
                            {item.disposable?.is_disposable === false && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                ✓ Не одноразовый
                              </span>
                            )}
                            {item.disposable?.is_disposable === true && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">
                                ⚠ Одноразовый
                              </span>
                            )}
                            {item.mx_records?.has_mx && (
                              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                                MX: {item.mx_records.mx_count}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
