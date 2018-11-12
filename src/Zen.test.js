/* @flow */

import test from 'ava'
import sinon from 'sinon'

import { Zen } from './Zen'

test.beforeEach((t: any) => {
  const login = sinon.stub()
  const fetchRefreshToken = sinon.stub()
  const fetchAccessToken = sinon.stub()

  const now = Date.now()

  login.withArgs('valid login', 'valid password').resolves({
    refreshToken: { value: 'refresh 1', expires: now + 1000 },
    accessToken: { value: 'access 1', expires: now + 1000 },
  })

  login.rejects(new Error('Wrong login or password'))

  fetchRefreshToken.withArgs('refresh 1').resolves({
    refreshToken: { value: 'refresh 2', expires: now + 2000 },
  })

  fetchRefreshToken.withArgs('refresh 2').resolves({
    refreshToken: { value: 'refresh 3', expires: now + 3000 },
  })

  fetchRefreshToken.rejects(new Error('Wrong refresh token'))

  fetchAccessToken.withArgs('refresh 1').resolves({
    accessToken: { value: 'access 2', expires: now + 2000 },
  })

  fetchAccessToken.withArgs('refresh 2').resolves({
    accessToken: { value: 'access 3', expires: now + 3000 },
  })

  fetchAccessToken.rejects(new Error('Wrong refresh token'))

  const zen = new Zen({
    refreshOffset: 500,
    login,
    fetchRefreshToken,
    fetchAccessToken,
  })

  // eslint-disable-next-line
  t.context.zen = zen
})

const getZen = (t): Zen => (t.context: any).zen

test('either :: Zen', t => {
  const zen = getZen(t)

  zen
    .either()
    .tap(token =>
      t.fail(
        `must return Left(Error) when Zen isn't logged in, but it returned Right("${token}")`,
      ),
    )
    .tapL(e => t.deepEqual(e, new Error('Not logged in')))

  return zen
    .login('valid login', 'valid password')
    .then(result => {
      t.is(result.refreshToken.value, 'refresh 1')
      t.is(result.accessToken.value, 'access 1')

      zen
        .either()
        .tap(token => t.is(token, 'access 1'))
        .tapL(e =>
          t.fail(
            `must return Right(String) when Zen is logged in, but it returned Left(Error("${
              e.message
            }"))`,
          ),
        )
    })
    .then(() => {
      zen
        .logout()
        .either()
        .tap(token =>
          t.fail(
            `must return Left(Error) when Zen isn't logged in, but it returned Right("${token}")`,
          ),
        )
        .tapL(e => t.deepEqual(e, new Error('Not logged in')))
    })
    .then(() => zen.authByToken('refresh 1'))
    .then(result => {
      t.is(result.refreshToken.value, 'refresh 2')
      t.is(result.accessToken.value, 'access 2')

      zen
        .either()
        .tap(token => t.is(token, 'access 2'))
        .tapL(e =>
          t.fail(
            `must return Right(String) when Zen is logged in, but it returned Left(Error("${
              e.message
            }"))`,
          ),
        )
    })
})

test('maybe :: Zen', t => {
  const zen = getZen(t)

  zen
    .maybe()
    .tap(token =>
      t.fail(
        `must return Nothing when Zen isn't logged in, but it returned Just("${token}")`,
      ),
    )

  return zen
    .login('valid login', 'valid password')
    .then(result => {
      t.is(result.refreshToken.value, 'refresh 1')
      t.is(result.accessToken.value, 'access 1')

      zen
        .maybe()
        .toEither(
          'must return Just(String) when Zen is logged in, but it returned Nothing',
        )
        .tap(token => t.is(token, 'access 1'))
        .tapL(t.fail)
    })
    .then(() =>
      zen
        .logout()
        .maybe()
        .tap(token =>
          t.fail(
            `must return Nothing when Zen isn't logged in, but it returned Just("${token}")`,
          ),
        ),
    )
    .then(() => zen.authByToken('refresh 1'))
    .then(result => {
      t.is(result.refreshToken.value, 'refresh 2')
      t.is(result.accessToken.value, 'access 2')

      zen
        .maybe()
        .toEither(
          'must return Just(String) when Zen is logged in, but it returned Nothing',
        )
        .tap(token => t.is(token, 'access 2'))
        .tapL(t.fail)
    })
})

test('then :: Zen', t => {
  const zen = getZen(t)

  return zen
    .then(
      (token): void =>
        t.fail(
          "must return rejected Promise when Zen isn't logged in, " +
            `but it returned resolved Promise("${token}")`,
        ),
    )
    .catch(e => t.deepEqual(e, new Error('Not logged in')))
    .then(() => zen.login('valid login', 'valid password'))
    .then(result => {
      t.is(result.refreshToken.value, 'refresh 1')
      t.is(result.accessToken.value, 'access 1')

      return zen
        .then((token): void => t.is(token, 'access 1'))
        .catch(e =>
          t.fail(
            'must return resolved Promise(String) when Zen is logged in, ' +
              `but it returned rejected Promise with Error("${e.message}")`,
          ),
        )
    })
    .then(() =>
      zen
        .logout()
        .then(
          (token): void =>
            t.fail(
              "must return rejected Promise when Zen isn't logged in, " +
                `but it returned resolved Promise("${token}")`,
            ),
        )
        .catch(e => t.deepEqual(e, new Error('Not logged in'))),
    )
    .then(() => zen.authByToken('refresh 1'))
    .then(result => {
      t.is(result.refreshToken.value, 'refresh 2')
      t.is(result.accessToken.value, 'access 2')

      return zen
        .then((token): void => t.is(token, 'access 2'))
        .catch(e =>
          t.fail(
            'must return resolved Promise(String) when Zen is logged in, ' +
              `but it returned rejected Promise with Error("${e.message}")`,
          ),
        )
    })
})

test.cb('on :: Zen', t => {
  const zen = getZen(t)

  const loginSuccess = sinon.stub()
  const loginFail = sinon.stub()
  const authByTokenSuccess = sinon.stub()
  const authByTokenFail = sinon.stub()
  const fetchTokenFail = sinon.stub()
  const tokenRefresh = sinon.stub()
  const tokenWarn = sinon.stub()
  const tokenExpire = sinon.stub()

  const logout = sinon
    .stub()
    .onCall(1)
    .callsFake(() => {})

  zen.on('login success', loginSuccess)
  zen.on('login fail', loginFail)
  zen.on('auth by token success', authByTokenSuccess)
  zen.on('auth by token fail', authByTokenFail)
  zen.on('logout', logout)
  zen.on('fetch token fail', fetchTokenFail)
  zen.on('token refresh', tokenRefresh)
  zen.on('token warn', tokenWarn)
  zen.on('token expire', tokenExpire)

  zen
    .login('invalid login', 'invalid password')
    .catch(() =>
      t.deepEqual(
        loginFail.getCall(0).args[0],
        new Error('Wrong login or password'),
      ),
    )
    .then(() => zen.login('valid login', 'valid password'))
    .then(() => {
      const { args } = loginSuccess.getCall(0)

      t.is(loginSuccess.getCalls().length, 1)
      t.is(args[0].type, 'refresh')
      t.is(args[0].value, 'refresh 1')
      t.is(args[1].type, 'access')
      t.is(args[1].value, 'access 1')
    })
    .then(() => {
      zen.logout()
      t.end()
    })
})
