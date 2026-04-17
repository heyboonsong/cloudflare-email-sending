import * as E from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/function'

// ============================================================================
// Types
// ============================================================================

interface EmailRequest {
  to: string
  from: string
  subject: string
  html?: string
  text?: string
}

interface ValidationError {
  field: string
  message: string
}

interface Env {
  SEND_EMAIL: SendEmail
}

// ============================================================================
// Pure Logic - No side effects, deterministic transformations
// ============================================================================

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const validateEmailRequestData = (data: EmailRequest): E.Either<ValidationError[], EmailRequest> => {
  if (!data || typeof data !== 'object') {
    return E.left([{ field: 'body', message: 'Request body must be a valid object' }])
  }

  const errors: ValidationError[] = []

  if (!data.to || typeof data.to !== 'string') {
    errors.push({ field: 'to', message: 'to field is required and must be a string' })
  } else if (!isValidEmail(data.to)) {
    errors.push({ field: 'to', message: 'to must be a valid email address' })
  }

  if (!data.from || typeof data.from !== 'string') {
    errors.push({ field: 'from', message: 'from field is required and must be a string' })
  } else if (!isValidEmail(data.from)) {
    errors.push({ field: 'from', message: 'from must be a valid email address' })
  }

  if (!data.subject || typeof data.subject !== 'string') {
    errors.push({ field: 'subject', message: 'subject field is required and must be a string' })
  }

  if (data.html !== undefined && typeof data.html !== 'string') {
    errors.push({ field: 'html', message: 'html must be a string' })
  }

  if (data.text !== undefined && typeof data.text !== 'string') {
    errors.push({ field: 'text', message: 'text must be a string' })
  }

  if (!data.html && !data.text) {
    errors.push({ field: 'content', message: 'At least one of html or text must be provided' })
  }

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

const determineHttpStatusCode = (error: string): number => {
  if (error === 'Method not allowed') return 405
  if (error.startsWith('Validation failed:')) return 400
  if (error === 'Failed to parse request body') return 400
  return 500
}

// ============================================================================
// Pure Functions - Deterministic output, no side effects
// ============================================================================

const validateHttpPostMethod = (method: string): E.Either<string, void> =>
  method === 'POST' ? E.right(undefined) : E.left('Method not allowed')

const formatValidationErrors = (errors: ValidationError[]): string =>
  `Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`

const createJsonResponse = <A>(
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
