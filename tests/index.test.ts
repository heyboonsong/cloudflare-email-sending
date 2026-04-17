import * as E from 'fp-ts/Either'
import { isValidEmail, validateEmailRequestData, determineHttpStatusCode, validateHttpPostMethod, formatValidationErrors, createJsonResponse, EmailRequest } from '../src/index'

describe('Email Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.org')).toBe(true)
      expect(isValidEmail('user+tag@email.co.uk')).toBe(true)
    })

    it('should return false for invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('invalid@')).toBe(false)
      expect(isValidEmail('@domain.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })
  })

  describe('validateEmailRequestData', () => {
    it('should return right for valid email request', () => {
      const validRequest = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test Subject',
        html: '<h1>Test</h1>',
      }

      const result = validateEmailRequestData(validRequest)
      
      expect(E.isRight(result)).toBe(true)
      if (E.isRight(result)) {
        expect(result.right.to).toBe('recipient@example.com')
        expect(result.right.from).toBe('sender@example.com')
        expect(result.right.subject).toBe('Test Subject')
        expect(result.right.html).toBe('<h1>Test</h1>')
      }
    })

    it('should accept text-only emails', () => {
      const request = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Plain text content',
      }

      const result = validateEmailRequestData(request)
      expect(E.isRight(result)).toBe(true)
    })

    it('should reject null data', () => {
      const result = validateEmailRequestData(null as any)
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left).toContainEqual({
          field: 'body',
          message: 'Request body must be a valid object',
        })
      }
    })

    it('should reject non-object data', () => {
      const result = validateEmailRequestData('string' as any)
      expect(E.isLeft(result)).toBe(true)
    })

    it('should reject missing to field', () => {
      const request = {
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Content',
      } as EmailRequest

      const result = validateEmailRequestData(request)
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left).toContainEqual({
          field: 'to',
          message: 'to field is required and must be a string',
        })
      }
    })

    it('should reject invalid to email', () => {
      const request = {
        to: 'invalid-email',
        from: 'sender@example.com',
        subject: 'Test',
        text: 'Content',
      }

      const result = validateEmailRequestData(request)
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left).toContainEqual({
          field: 'to',
          message: 'to must be a valid email address',
        })
      }
    })

    it('should reject missing from field', () => {
      const request = {
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Content',
      } as EmailRequest

      const result = validateEmailRequestData(request)
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left).toContainEqual({
          field: 'from',
          message: 'from field is required and must be a string',
        })
      }
    })

    it('should reject missing subject field', () => {
      const request = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        text: 'Content',
      } as EmailRequest

      const result = validateEmailRequestData(request)
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left).toContainEqual({
          field: 'subject',
          message: 'subject field is required and must be a string',
        })
      }
    })

    it('should reject when both html and text are missing', () => {
      const request = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
      }

      const result = validateEmailRequestData(request)
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left).toContainEqual({
          field: 'content',
          message: 'At least one of html or text must be provided',
        })
      }
    })

    it('should reject invalid html type', () => {
      const request = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        html: 123,
      } as any

      const result = validateEmailRequestData(request)
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left).toContainEqual({
          field: 'html',
          message: 'html must be a string',
        })
      }
    })

    it('should reject invalid text type', () => {
      const request = {
        to: 'recipient@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        text: 456,
      } as any

      const result = validateEmailRequestData(request)
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left).toContainEqual({
          field: 'text',
          message: 'text must be a string',
        })
      }
    })

    it('should collect multiple validation errors', () => {
      const request = {
        to: 'invalid',
        from: '',
        subject: '',
      }

      const result = validateEmailRequestData(request)
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left.length).toBeGreaterThanOrEqual(3)
      }
    })
  })

  describe('validateHttpPostMethod', () => {
    it('should return right for POST method', () => {
      const result = validateHttpPostMethod('POST')
      expect(E.isRight(result)).toBe(true)
    })

    it('should return left for GET method', () => {
      const result = validateHttpPostMethod('GET')
      expect(E.isLeft(result)).toBe(true)
      if (E.isLeft(result)) {
        expect(result.left).toBe('Method not allowed')
      }
    })

    it('should return left for PUT method', () => {
      const result = validateHttpPostMethod('PUT')
      expect(E.isLeft(result)).toBe(true)
    })

    it('should return left for DELETE method', () => {
      const result = validateHttpPostMethod('DELETE')
      expect(E.isLeft(result)).toBe(true)
    })
  })

  describe('formatValidationErrors', () => {
    it('should format single error correctly', () => {
      const errors = [
        { field: 'to', message: 'to is required' },
      ]

      const result = formatValidationErrors(errors)
      expect(result).toBe('Validation failed: to: to is required')
    })

    it('should format multiple errors correctly', () => {
      const errors = [
        { field: 'to', message: 'to is required' },
        { field: 'from', message: 'from is required' },
      ]

      const result = formatValidationErrors(errors)
      expect(result).toBe('Validation failed: to: to is required, from: from is required')
    })
  })

  describe('determineHttpStatusCode', () => {
    it('should return 405 for method not allowed', () => {
      expect(determineHttpStatusCode('Method not allowed')).toBe(405)
    })

    it('should return 400 for validation errors', () => {
      expect(determineHttpStatusCode('Validation failed: to is required')).toBe(400)
    })

    it('should return 400 for parse errors', () => {
      expect(determineHttpStatusCode('Failed to parse request body')).toBe(400)
    })

    it('should return 500 for other errors', () => {
      expect(determineHttpStatusCode('Some random error')).toBe(500)
    })
  })

  describe('createJsonResponse', () => {
    it('should create success response with data', () => {
      const response = createJsonResponse(true, { id: '123' })
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      
      return response.json().then((data: any) => {
        expect(data.success).toBe(true)
        expect(data.id).toBe('123')
      })
    })

    it('should create error response with message', () => {
      const response = createJsonResponse(false, undefined, 'Error message')
      
      expect(response.status).toBe(500)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      
      return response.json().then((data: any) => {
        expect(data.success).toBe(false)
        expect(data.error).toBe('Error message')
      })
    })

    it('should respect custom status code', () => {
      const response = createJsonResponse(false, undefined, 'Bad request', 400)
      expect(response.status).toBe(400)
    })

    it('should use determined status for error responses', () => {
      const response = createJsonResponse(false, undefined, 'Validation failed: test')
      expect(response.status).toBe(400)
    })
  })
})
