import * as E from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/function'

// ============================================================================
// Types
// ============================================================================

export interface EmailRequest {
  to: string
  from: string
  subject: string
  html?: string
  text?: string
}

export interface ValidationError {
  field: string
  message: string
}

interface Env {
  SEND_EMAIL: SendEmail
}

// ============================================================================
// Pure Logic - No side effects, deterministic transformations
// ============================================================================

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const validateField = (field: string, value: string | undefined, validations: Array<[string, (val: string) => boolean]>): ValidationError[] => {
  if (!value || typeof value !== 'string') {
    return [{ field, message: `${field} field is required and must be a string` }]
  }
  
  const errors: ValidationError[] = []
  for (const [message, validator] of validations) {
    if (!validator(value)) {
      errors.push({ field, message })
    }
  }
  return errors
}

const validateEmailField = (field: string, value: string | undefined): ValidationError[] =>
  validateField(field, value, [
    [`${field} must be a valid email address`, isValidEmail],
  ])

const validateRequiredString = (field: string, value: string | undefined): ValidationError[] =>
  validateField(field, value, [])

const validateOptionalString = (field: string, value: string | undefined): ValidationError[] => {
  if (value !== undefined && typeof value !== 'string') {
    return [{ field, message: `${field} must be a string` }]
  }
  return []
}

const validateContentRequirement = (html: string | undefined, text: string | undefined): ValidationError[] => {
  if (!html && !text) {
    return [{ field: 'content', message: 'At least one of html or text must be provided' }]
  }
  return []
}

export const validateEmailRequestData = (data: EmailRequest): E.Either<ValidationError[], EmailRequest> => {
  if (!data || typeof data !== 'object') {
    return E.left([{ field: 'body', message: 'Request body must be a valid object' }])
  }

  const errors = [
    ...validateEmailField('to', data.to),
    ...validateEmailField('from', data.from),
    ...validateRequiredString('subject', data.subject),
    ...validateOptionalString('html', data.html),
    ...validateOptionalString('text', data.text),
    ...validateContentRequirement(data.html, data.text),
  ]

  return errors.length > 0
    ? E.left(errors)
    : E.right({
        to: data.to,
        from: data.from,
        subject: data.subject,
        html: data.html,
        text: data.text,
      })
}

export const determineHttpStatusCode = (error: string): number => {
  if (error === 'Method not allowed') return 405
  if (error.startsWith('Validation failed:')) return 400
  if (error === 'Failed to parse request body') return 400
  return 500
}

// ============================================================================
// Pure Functions - Deterministic output, no side effects
// ============================================================================

export const validateHttpPostMethod = (method: string): E.Either<string, void> =>
  method === 'POST' ? E.right(undefined) : E.left('Method not allowed')

export const formatValidationErrors = (errors: ValidationError[]): string =>
  `Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`

export const createJsonResponse = <A>(
  success: boolean,
  data?: A,
  error?: string,
  status?: number,
): Response => {
  const resolvedStatus = status ?? (success ? 200 : determineHttpStatusCode(error ?? ''))

  return new Response(
    JSON.stringify(success ? { success, ...data } : { success, error }),
    {
      status: resolvedStatus,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

// ============================================================================
// Side Effects - I/O operations wrapped in TaskEither
// ============================================================================

const parseRequestJson = (request: Request): TE.TaskEither<string, EmailRequest> =>
  TE.tryCatch(
    async () => request.json() as Promise<EmailRequest>,
    (error) => error instanceof Error ? error.message : 'Failed to parse request body',
  )

const sendEmailViaService = (
  env: Env,
  emailData: EmailRequest,
): TE.TaskEither<string, { messageId: string }> =>
  TE.tryCatch(
    async () => {
      const response = await env.SEND_EMAIL.send(emailData)
      return { messageId: response.messageId }
    },
    (error) => error instanceof Error ? error.message : 'Failed to send email',
  )

const logErrorToConsole = (error: string): void => console.error(error)

// ============================================================================
// Composition - Orchestrate pure logic and side effects
// ============================================================================

const parseAndValidateEmailRequest = (request: Request): TE.TaskEither<string, EmailRequest> =>
  pipe(
    parseRequestJson(request),
    TE.chain((data) =>
      pipe(
        validateEmailRequestData(data),
        E.mapLeft(formatValidationErrors),
        TE.fromEither,
      ),
    ),
  )

const handleEmailSending = (env: Env) => (emailData: EmailRequest): TE.TaskEither<string, Response> =>
  pipe(
    sendEmailViaService(env, emailData),
    TE.map(({ messageId }) => createJsonResponse(true, { id: messageId })),
  )

const handleEmailRequest = (request: Request, env: Env): TE.TaskEither<string, Response> =>
  pipe(
    TE.fromEither(validateHttpPostMethod(request.method)),
    TE.chain(() => parseAndValidateEmailRequest(request)),
    TE.chain(handleEmailSending(env)),
  )

// ============================================================================
// HTTP Handler Entry Point
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return await pipe(
      handleEmailRequest(request, env),
      TE.match(
        (error) => {
          logErrorToConsole(error)
          return createJsonResponse(false, undefined, error)
        },
        (response) => response,
      ),
    )()
  },
}
