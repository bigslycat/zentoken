/* @flow */

import EventEmitter from 'events'

import * as i from 'igogo'

import { getSet } from './getSet'
import * as t from './Token'

const createEmitter = (): ZenEmitter => (new EventEmitter(): any)

const [getOptions, setOptions] = getSet('options')

// eslint-disable-next-line
const [getAccessToken, _setAccessToken] = getSet/* :: <i.Either<Error, t.Token>> */(
  'accessToken',
)

// eslint-disable-next-line
const [getRefreshToken, _setRefreshToken] = getSet/* :: <i.Either<Error, t.Token>> */(
  'refreshToken',
)

const [getEmitter, setEmitter] = getSet('emitter')

const subscribe = zen => {
  const emitter = getEmitter(zen)
  return token => {
    token.on('warn', tkn => emitter.emit('token warn', tkn.toData()))
    token.on('expire', tkn => emitter.emit('token expire', tkn.toData()))
  }
}

const setAccessToken = (zen: Zen, either: i.Either<Error, t.Token>) => {
  getAccessToken(zen).tap(t.removeAllListeners())
  return _setAccessToken(zen, either).tap(subscribe(zen))
}

const setRefreshToken = (zen: Zen, either: i.Either<Error, t.Token>) => {
  getRefreshToken(zen).tap(t.removeAllListeners())
  return _setRefreshToken(zen, either).tap(subscribe(zen))
}

const saveRefreshToken = (zen: Zen) => {
  const { refreshOffset: warnFor } = getOptions(zen)
  return (response: {
    refreshToken: { expires: string | number | Date, value: string },
  }): t.Token => {
    const token = t.of({ ...response.refreshToken, warnFor, type: 'refresh' })
    setRefreshToken(zen, i.Right(token))
    return token
  }
}

const saveAccessToken = (zen: Zen) => {
  const { refreshOffset: warnFor } = getOptions(zen)
  return (response: {
    accessToken: { expires: string | number | Date, value: string },
  }): t.Token => {
    const token = t.of({ ...response.accessToken, warnFor, type: 'access' })
    setAccessToken(zen, i.Right(token))
    return token
  }
}

const saveTokens = (zen: Zen) => {
  const refreshToken = saveRefreshToken(zen)
  const accessToken = saveAccessToken(zen)
  return (response: {
    accessToken: { expires: string | number | Date, value: string },
    refreshToken: { expires: string | number | Date, value: string },
  }): {
    refreshToken: { value: string, expires: Date, type: t.Type },
    accessToken: { value: string, expires: Date, type: t.Type },
  } => ({
    refreshToken: refreshToken(response).toData(),
    accessToken: accessToken(response).toData(),
  })
}

const notLoggedIn = () => i.Left(new Error('Not logged in'))

const fetchRefreshToken = (zen: Zen) => (
  refreshToken: t.Token,
): Promise<t.Token> =>
  getOptions(zen)
    .fetchRefreshToken(refreshToken.value)
    .then(saveRefreshToken(zen))

const fetchAccessToken = (zen: Zen) => (
  refreshToken: t.Token,
): Promise<t.Token> =>
  getOptions(zen)
    .fetchAccessToken(refreshToken.value)
    .then(saveAccessToken(zen))

const validEvents: [
  'login success',
  'auth by token success',
  'login fail',
  'auth by token fail',
  'logout',
  'fetch token fail',
  'token refresh',
  'token warn',
  'token expire',
] = [
  'login success',
  'auth by token success',
  'login fail',
  'auth by token fail',
  'logout',
  'fetch token fail',
  'token refresh',
  'token warn',
  'token expire',
]

type EventName = $Call<<T>($ReadOnlyArray<T>) => T, typeof validEvents>

type URLRules =
  | string
  | RegExp
  | ((url: string) => boolean)
  | $ReadOnlyArray<string | RegExp | ((url: string) => boolean)>

const defaultRegExp = /^https?:\/\//
const defaultRule = url => !defaultRegExp.test(url)

const compile = (config: URLRules = defaultRule) => {
  const rules: $ReadOnlyArray<(string) => boolean> = []
    .concat(config)
    .map(rule => {
      if (typeof rule == 'string') return url => rule === url
      if (typeof rule == 'function') return rule
      if (rule instanceof RegExp) return url => rule.test(url)
      throw new Error('')
    })

  return (url: string): boolean => rules.some(test => test(url))
}

export type Options = {
  refreshOffset: number,

  login(
    login: string,
    password: string,
  ): Promise<{
    accessToken: {
      value: string,
      expires: string | number | Date,
    },
    refreshToken: {
      value: string,
      expires: string | number | Date,
    },
  }>,

  fetchRefreshToken(
    refreshToken: string,
  ): Promise<{
    refreshToken: {
      value: string,
      expires: string | number | Date,
    },
  }>,

  fetchAccessToken(
    refreshToken: string,
  ): Promise<{
    accessToken: {
      value: string,
      expires: string | number | Date,
    },
  }>,
}

export class Zen {
  constructor(options: Options): Zen {
    setOptions(this, options)

    _setAccessToken(this, notLoggedIn())
    _setRefreshToken(this, notLoggedIn())

    const emitter = setEmitter(this, createEmitter()).setMaxListeners(Infinity)

    const emitRefresh = newToken =>
      emitter.emit('token refresh', newToken.toData())

    const emitFetchFail = e => emitter.emit('fetch token fail', e)

    emitter.on('token warn', token =>
      getRefreshToken(this)
        .chain(t.expired)
        .promise()
        .then(
          token.type === 'refresh'
            ? fetchRefreshToken(this)
            : fetchAccessToken(this),
        )
        .then(emitRefresh)
        .catch(emitFetchFail),
    )

    emitter.on('token expire', token => {
      switch (token.type) {
        case 'access':
          getRefreshToken(this)
            .chain(t.expired)
            .promise()
            .then(fetchAccessToken(this))
            .then(emitRefresh)
            .catch(emitFetchFail)
          break

        case 'refresh':
          setAccessToken(this, notLoggedIn())
          setRefreshToken(this, notLoggedIn())
          break

        default:
          /* :: (token.type: empty) */
          throw new Error('Unknown token type')
      }
    })

    /* :: return this */
  }

  login(
    login: string,
    password: string,
  ): Promise<{
    refreshToken: { value: string, expires: Date, type: t.Type },
    accessToken: { value: string, expires: Date, type: t.Type },
  }> {
    const options = getOptions(this)
    const emitter = getEmitter(this)

    return options
      .login(login, password)
      .then(saveTokens(this))
      .then(result => {
        emitter.emit('login success', result.refreshToken, result.accessToken)
        return result
      })
      .catch(error => {
        emitter.emit('login fail', error)
        return Promise.reject(error)
      })
  }

  authByToken(
    refreshTokenValue: string,
  ): Promise<{
    refreshToken: { value: string, expires: Date, type: t.Type },
    accessToken: { value: string, expires: Date, type: t.Type },
  }> {
    const options = getOptions(this)
    const emitter = getEmitter(this)

    return Promise.all([
      options
        .fetchRefreshToken(refreshTokenValue)
        .then(result => result.refreshToken),
      options
        .fetchAccessToken(refreshTokenValue)
        .then(result => result.accessToken),
    ])
      .then(response => ({
        refreshToken: response[0],
        accessToken: response[1],
      }))
      .then(saveTokens(this))
      .then(result => {
        emitter.emit(
          'auth by token success',
          result.refreshToken,
          result.accessToken,
        )
        return result
      })
      .catch(error => {
        emitter.emit('auth by token fail', error)
        return Promise.reject(error)
      })
  }

  logout() {
    setAccessToken(this, notLoggedIn())
    setRefreshToken(this, notLoggedIn())
    getEmitter(this).emit('logout')
    return this
  }

  /* ::
  +on: ((
    eventName: 'login success' | 'auth by token success',
    listener: (
      refreshToken: { value: string, expires: Date, type: t.Type },
      accessToken: { value: string, expires: Date, type: t.Type },
    ) => mixed,
  ) => Zen) &
    ((
      eventName: 'login fail' | 'auth by token fail' | 'fetch token fail',
      listener: (Error) => mixed) => Zen) &
    ((
      eventName: 'logout',
      listener: () => mixed) => Zen) &
    ((
      eventName: 'token refresh' | 'token warn' | 'token expire',
      listener: (token: { value: string, expires:Date, type: t.Type }) => mixed,
    ) => Zen) & (
      eventName: 'token refresh' | 'token warn' | 'token expire',
      listener: (token: { value: string, expires: Date, type: t.Type }) => mixed,
    ) => Zen

  +off: $PropertyType<Zen, 'on'>
  */

  on(eventName: EventName, listener: Function): Zen {
    if (!validEvents.includes(eventName)) {
      throw new Error(`Unknown event name: ${eventName}`)
    }

    getEmitter(this).on(eventName, listener)

    return this
  }

  off(eventName: EventName, listener: Function): Zen {
    getEmitter(this).off(eventName, listener)
    return this
  }

  /* ::
  +then: ((onFulfill?: void | null, ...void[]) => Promise<string>) &
    (<T>(
      onFulfill: (string) => Promise<T> | T,
      ...void[]
    ) => Promise<T>) &
    (<T>(
      onFulfill: void | null,
      onReject: (Error) => Promise<T> | T,
    ) => Promise<string | T>) &
    (<T1, T2>(
      onFulfill: (string) => Promise<T1> | T1,
      onReject: (Error) => Promise<T2> | T2,
    ) => Promise<T1 | T2>)

  */

  then(onFulfill: string => mixed, onReject: Error => mixed): Promise<any> {
    return getAccessToken(this)
      .map(t.value)
      .promise()
      .then(onFulfill, onReject)
  }

  wrapFetch(
    options:
      | ((accessTokenValue: string, headers: Headers) => mixed)
      | {
          setHeader(accessTokenValue: string, headers: Headers): mixed,
          handleURLs?: URLRules,
          fetch?: typeof fetch,
        },
  ): typeof fetch {
    const call: typeof fetch = options.fetch || fetch
    const checkURL = compile(options.handleURLs)
    return (input: RequestInfo, init?: RequestOptions) => {
      const request = new Request(input, init)
      if (!checkURL(request.url)) return call(request)
      return getAccessToken(this)
        .promise()
        .then(accessToken => {
          options.setHeader(accessToken.value, request.headers)
          return call(request)
        })
    }
  }

  axios(
    options:
      | ((accessTokenValue: string, headers: Headers) => mixed)
      | {
          setHeader(accessTokenValue: string, headers?: Object): Object,
          handleURLs?: URLRules,
        },
  ): <R: { url: string, headers?: Object }>(response: R) => Promise<R> | R {
    const checkURL = compile(options.handleURLs)
    return <R: { url: string, headers?: Object }>(
      response: R,
    ): Promise<R> | R => {
      if (!checkURL(response.url)) return response
      return getAccessToken(this)
        .map(accessToken => {
          response.headers = options.setHeader(
            accessToken.value,
            response.headers,
          )
          return response
        })
        .promise()
    }
  }
}

interface ZenEmitter {
  removeAllListeners(eventName: EventName): ZenEmitter;
  setMaxListeners(count: number): ZenEmitter;

  off(eventName: string, listener: Function): ZenEmitter;

  on(
    eventName: 'login success' | 'auth by token success',
    listener: (
      refreshToken: { value: string, expires: Date },
      accessToken: { value: string, expires: Date },
    ) => mixed,
  ): ZenEmitter;

  emit(
    eventName: 'login success' | 'auth by token success',
    refreshToken: { value: string, expires: Date, type: t.Type },
    accessToken: { value: string, expires: Date, type: t.Type },
  ): boolean;

  on(
    eventName: 'login fail' | 'auth by token fail' | 'fetch token fail',
    listener: (Error) => mixed,
  ): ZenEmitter;
  emit(
    eventName: 'login fail' | 'auth by token fail' | 'fetch token fail',
    Error,
  ): ZenEmitter;

  on(eventName: 'logout', listener: () => mixed): Zen;
  emit(eventName: 'logout'): Zen;

  on(
    eventName: 'token refresh' | 'token warn' | 'token expire',
    listener: (token: { value: string, expires: Date, type: t.Type }) => mixed,
  ): ZenEmitter;

  emit(
    eventName: 'token refresh' | 'token warn' | 'token expire',
    token: { value: string, expires: Date, type: t.Type },
  ): ZenEmitter;
}
