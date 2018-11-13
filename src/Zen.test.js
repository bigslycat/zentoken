/* @flow */

import test from 'ava'
import sinon from 'sinon'

import { Zen } from './Zen'

const clock = sinon.useFakeTimers({
  now: new Date(1987, 3, 18),
})

test.beforeEach(t => {
  clock.reset()

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

  Object.assign((t.context: any), { zen })
})

const getZen = (t): Zen => (t.context: any).zen

test('login :: Zen', async t => {
  const zen = getZen(t)

  await zen
    .login('invalid login', 'invalid password')
    .then(() => t.fail())
    .catch(e => t.deepEqual(e, new Error('Wrong login or password')))

  t.deepEqual(await zen.login('valid login', 'valid password'), {
    refreshToken: {
      value: 'refresh 1',
      type: 'refresh',
      expires: new Date(Date.now() + 1000),
    },
    accessToken: {
      value: 'access 1',
      type: 'access',
      expires: new Date(Date.now() + 1000),
    },
  })

  t.is(await zen, 'access 1')
})

test('authByToken :: Zen', async t => {
  const zen = getZen(t)

  await zen
    .authByToken('invalid refresh token')
    .then(() => t.fail())
    .catch(e => t.deepEqual(e, new Error('Wrong refresh token')))

  t.deepEqual(await zen.authByToken('refresh 1'), {
    refreshToken: {
      value: 'refresh 2',
      type: 'refresh',
      expires: new Date(Date.now() + 2000),
    },
    accessToken: {
      value: 'access 2',
      type: 'access',
      expires: new Date(Date.now() + 2000),
    },
  })

  t.is(await zen, 'access 2')
})

test('logout :: Zen', async t => {
  const zen = getZen(t)
  await zen.authByToken('refresh 1')
  await zen
    .logout()
    .then()
    .catch(e => t.deepEqual(e, new Error('Not logged in')))
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
})

test('LoginSuccessEvent :: Zen', async t => {
  const zen = getZen(t)
  const listener = sinon.stub()
  await zen.on('login success', listener).login('valid login', 'valid password')
  t.is(listener.callCount, 1)
  t.deepEqual(listener.lastCall.args, [
    {
      value: 'refresh 1',
      type: 'refresh',
      expires: new Date(Date.now() + 1000),
    },
    {
      value: 'access 1',
      type: 'access',
      expires: new Date(Date.now() + 1000),
    },
  ])
})

test('LoginFailEvent :: Zen', async t => {
  const zen = getZen(t)
  const listener = sinon.stub()
  await zen
    .on('login fail', listener)
    .login('invalid login', 'invalid password')
    .catch(e => e)
  t.is(listener.callCount, 1)
  t.deepEqual(listener.lastCall.args, [new Error('Wrong login or password')])
})

test('AuthByTokenSuccessEvent :: Zen', async t => {
  const zen = getZen(t)
  const listener = sinon.stub()
  await zen.on('auth by token success', listener).authByToken('refresh 1')
  t.is(listener.callCount, 1)
  t.deepEqual(listener.lastCall.args, [
    {
      value: 'refresh 2',
      type: 'refresh',
      expires: new Date(Date.now() + 2000),
    },
    {
      value: 'access 2',
      type: 'access',
      expires: new Date(Date.now() + 2000),
    },
  ])
})

test('AuthByTokenFailEvent :: Zen', async t => {
  const zen = getZen(t)
  const listener = sinon.stub()
  await zen
    .on('auth by token fail', listener)
    .authByToken('invalid token')
    .catch(e => e)
  t.is(listener.callCount, 1)
  t.deepEqual(listener.lastCall.args, [new Error('Wrong refresh token')])
})

test.serial('TokenWarnEvent :: Zen', async t => {
  const zen = getZen(t)
  const listener = sinon.stub()
  await zen.on('token warn', listener).authByToken('refresh 2')

  clock.tick(2499)
  t.is(listener.callCount, 0)

  clock.tick(1)
  t.is(listener.callCount, 2)

  t.deepEqual(listener.getCall(0).args, [
    {
      expires: new Date(Date.now() + 500),
      type: 'refresh',
      value: 'refresh 3',
    },
  ])

  t.deepEqual(listener.getCall(1).args, [
    {
      expires: new Date(Date.now() + 500),
      type: 'access',
      value: 'access 3',
    },
  ])
})

test.serial.cb('FetchTokenFailEvent :: Zen', t => {
  const zen = getZen(t)
  const listener = sinon.stub().callsFake(() => {
    t.deepEqual(listener.lastCall.args, [new Error('Wrong refresh token')])
    if (listener.callCount === 2) t.end()
  })

  zen
    .on('fetch token fail', listener)
    .authByToken('refresh 2')
    .then(() => clock.tick(2500))
})
