/* @flow */

import test from 'ava'
import sinon from 'sinon'

import { Zen } from './Zen'

const login = sinon.stub()
const fetchRefreshToken = sinon.stub()
const fetchAccessToken = sinon.stub()

test.beforeEach((t: any) => {
  login.reset()
  fetchRefreshToken.reset()
  fetchAccessToken.reset()

  login.withArgs('valid login', 'valid password').resolves({
    refreshToken: { value: 'refresh 1', expires: Date.now() },
    accessToken: { value: 'access 1', expires: Date.now() },
  })

  login.rejects(new Error('Wrong login or password'))

  fetchRefreshToken.withArgs('refresh 1').resolves({
    refreshToken: { value: 'refresh 2', expires: Date.now() },
  })

  fetchRefreshToken.rejects(new Error('Wrong refresh token'))

  fetchAccessToken.withArgs('refresh 1').resolves({
    accessToken: { value: 'access 2', expires: Date.now() },
  })

  fetchAccessToken.rejects(new Error('Wrong refresh token'))

  // eslint-disable-next-line
  t.context.zen = new Zen({
    refreshOffset: 500,
    login,
    fetchRefreshToken,
    fetchAccessToken,
  })
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

  return zen.login('valid login', 'valid password').then(result => {
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
    .then(() =>
      zen.login('valid login', 'valid password').then(result => {
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
      }),
    )
})
