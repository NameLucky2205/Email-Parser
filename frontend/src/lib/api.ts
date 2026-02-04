import type { ExtractResponse, ValidationResult, BulkValidationResponse } from '../types'

const API_BASE_URL = 'http://localhost:8002'

export const api = {
  async extractFromText(text: string, strict: boolean = false): Promise<ExtractResponse> {
    const response = await fetch(`${API_BASE_URL}/api/extract/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, strict }),
    })
    if (!response.ok) throw new Error('Failed to extract emails')
    return response.json()
  },

  async extractFromUrl(url: string, deepCrawl: boolean = false, maxDepth: number = 2): Promise<ExtractResponse> {
    const response = await fetch(`${API_BASE_URL}/api/extract/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, deep_crawl: deepCrawl, max_depth: maxDepth }),
    })
    if (!response.ok) throw new Error('Failed to extract emails from URL')
    return response.json()
  },

  async extractFromFile(file: File): Promise<ExtractResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/api/extract/file`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) throw new Error('Failed to extract emails from file')
    return response.json()
  },

  async validateEmail(email: string, checkMx: boolean = true, checkDisposable: boolean = true): Promise<ValidationResult> {
    const response = await fetch(`${API_BASE_URL}/api/validate/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, check_mx: checkMx, check_disposable: checkDisposable }),
    })
    if (!response.ok) throw new Error('Failed to validate email')
    return response.json()
  },

  async validateBulk(emails: string[], checkMx: boolean = true, checkDisposable: boolean = true): Promise<BulkValidationResponse> {
    const response = await fetch(`${API_BASE_URL}/api/validate/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, check_mx: checkMx, check_disposable: checkDisposable }),
    })
    if (!response.ok) throw new Error('Failed to validate emails')
    return response.json()
  },

  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    const response = await fetch(`${API_BASE_URL}/health`)
    if (!response.ok) throw new Error('Health check failed')
    return response.json()
  },
}
