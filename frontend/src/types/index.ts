export interface ExtractResponse {
  success: boolean
  emails: string[]
  count: number
  processing_time: number
  error?: string
}

export interface ValidationResult {
  success: boolean
  email: string
  valid: boolean
  username?: string
  domain?: string
  tld?: string
  checks?: {
    format: boolean
    mx?: boolean
    disposable?: boolean
  }
  mx_records?: {
    has_mx: boolean
    mx_records: Array<{ priority: number; host: string }>
    primary_mx?: string
    mx_count: number
  }
  disposable?: {
    is_disposable: boolean
    domain: string
  }
  provider?: {
    is_popular: boolean
    provider: string
    domain: string
  }
  risk_level?: 'low' | 'medium' | 'high'
  risk_score?: number
  error?: string
}

export interface BulkValidationResponse {
  success: boolean
  total: number
  valid: number
  invalid: number
  disposable: number
  high_risk: number
  valid_emails: string[]
  invalid_emails: Array<{ email: string; error: string }>
  disposable_emails: string[]
  high_risk_emails: string[]
  results: ValidationResult[]
  processing_time: number
}
