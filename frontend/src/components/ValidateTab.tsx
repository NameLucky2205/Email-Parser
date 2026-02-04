import React, { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Shield, Mail, Download } from 'lucide-react'
import { api } from '../lib/api'
import type { BulkValidationResponse, ValidationResult } from '../types'
import type { HistoryItem, ValidateHistoryItem } from '../types/history'
import { StatsCard } from './StatsCard'
import { exportValidationToExcel } from '../lib/excel'

interface ValidateTabProps {
  historyHook: ReturnType<typeof import('../hooks/useHistory').useHistory>
  selectedHistoryItem: HistoryItem | null
  onHistoryItemRestored: () => void
}

export function ValidateTab({ historyHook, selectedHistoryItem, onHistoryItemRestored }: ValidateTabProps) {
  const [emails, setEmails] = useState('')
  const [checkMx, setCheckMx] = useState(true)
  const [checkDisposable, setCheckDisposable] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BulkValidationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editedEmails, setEditedEmails] = useState<{ [index: number]: string }>({})

  // Restore results from history
  useEffect(() => {
    if (selectedHistoryItem && selectedHistoryItem.type === 'validate') {
      const validateItem = selectedHistoryItem as ValidateHistoryItem

      // Restore validation results
      setResult(validateItem.result)
      setError(null)

      // Notify parent that restoration is complete
      onHistoryItemRestored()
    }
  }, [selectedHistoryItem, onHistoryItemRestored])

  const handleValidate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const emailList = emails
        .split('\n')
        .map((e) => e.trim())
        .filter((e) => e.length > 0)

      if (emailList.length === 0) {
        throw new Error('Пожалуйста, введите email адреса')
      }

      const response = await api.validateBulk(emailList, checkMx, checkDisposable)
      setResult(response)
      setEditedEmails({}) // Сбросить отредактированные email

      // Сохранить в историю
      historyHook.addValidateHistory(emailList.length, response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка')
    } finally {
      setLoading(false)
    }
  }

  const handleRevalidateEdited = async () => {
    if (!result || Object.keys(editedEmails).length === 0) return

    setLoading(true)
    setError(null)

    try {
      // Создать новый массив результатов с отредактированными email
      const updatedResults = [...result.results]
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
          ...result,
          results: updatedResults,
          valid,
          invalid,
          disposable,
        }

        setResult(updatedValidationResult)
        setEditedEmails({}) // Очистить отредактированные email

        // Сохранить обновленные результаты в историю
        historyHook.addValidateHistory(updatedResults.length, updatedValidationResult)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при повторной валидации')
    } finally {
      setLoading(false)
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
          <Shield className="w-7 h-7 text-blue-500" />
          Валидация Email Адресов
        </h2>

        {/* Email Input */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Введите email адреса (по одному на строку):
          </label>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder={'example@gmail.com\ntest@yahoo.com\nuser@domain.com'}
            className="w-full h-48 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none resize-none font-mono text-sm"
          />

          {/* Options */}
          <div className="flex flex-wrap gap-4">
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
        </div>

        {/* Validate Button */}
        <button
          onClick={handleValidate}
          disabled={loading}
          className="w-full mt-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Валидация...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Валидировать
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard title="Всего" value={result.total} icon={<Mail className="w-6 h-6" />} />
            <StatsCard title="Валидные" value={result.valid} icon={<CheckCircle2 className="w-6 h-6" />} variant="success" />
            <StatsCard title="Невалидные" value={result.invalid} icon={<XCircle className="w-6 h-6" />} variant="danger" />
            <StatsCard
              title="Одноразовые"
              value={result.disposable}
              icon={<AlertTriangle className="w-6 h-6" />}
              variant="warning"
            />
          </div>

          {/* Export Button */}
          <div className="flex justify-end gap-3">
            {Object.keys(editedEmails).length > 0 && (
              <button
                onClick={handleRevalidateEdited}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {loading ? (
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
              onClick={() => exportValidationToExcel(result)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
            >
              <Download className="w-5 h-5" />
              Экспортировать в Excel
            </button>
          </div>

          {/* Validation Results */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Результаты валидации:</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {result.results.map((item, index) => (
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
  )
}
