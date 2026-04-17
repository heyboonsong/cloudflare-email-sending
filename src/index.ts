import * as E from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/function'

interface EmailRequest {
  to: string
  from: string
  subject: string
  html?: string
  text?: string
}

interface Env {
  SEND_EMAIL: SendEmail
}

// Pure functions - no side effects, deterministic output
const validateMethod = (method: string): E.Either<string, void> =>
  method === 'POST' ? E.right(undefined) : E.left('Method not allowed')

const createResponse = <A>(
  success: boolean,
  data?: A,
  error?: string,
  status: number = success ? 200 : 500,
): Response =>
  new Response(
    JSON.stringify(success ? { success, ...data } : { success, error }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  )

// Side effects - I/O operations as TaskEither
const parseRequestBody = (request: Request): TE.TaskEither<string, EmailRequest> =>
  TE.tryCatch(
    async () => {
      const data = await request.json<EmailRequest>()
      return data
    },
    (error) =>
      error instanceof Error ? error.message : 'Failed to parse request body',
  )

const sendEmail = (
  env: Env,
  emailData: EmailRequest,
): TE.TaskEither<string, { messageId: string }> =>
  TE.tryCatch(
    async () => {
      const response = await env.SEND_EMAIL.send(emailData)
      return { messageId: response.messageId }
    },
    (error) => (error instanceof Error ? error.message : 'Failed to send email'),
  )

const logError = (error: string): void => console.error(error)

// Handler composition using TaskEither
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const methodResult = validateMethod(request.method)

    if (E.isLeft(methodResult)) {
      logError(methodResult.left)
      return createResponse(false, undefined, methodResult.left, 405)
    }

    const result = await pipe(
      parseRequestBody(request),
      TE.chain((emailData: EmailRequest) => sendEmail(env, emailData)),
      TE.map(({ messageId }) => createResponse(true, { id: messageId })),
      TE.fold(
        (error: string) => {
          logError(error)
          const status = error === 'Failed to parse request body' ? 400 : 500
          return () => Promise.resolve(createResponse(false, undefined, error, status))
        },
        (response: Response) => () => Promise.resolve(response),
      ),
    )()

    return result
  },
}
