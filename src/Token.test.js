/* @flow */

import test from 'ava'
import sinon from 'sinon'

import * as Token from './Token'

const clock = sinon.useFakeTimers({
  now: new Date(1987, 3, 18),
})

const of = (options: $Shape<Token.Options>) =>
  Token.of({
    value: 'VALUE',
    expires: Date.now() + 1000,
    warnFor: 500,
    type: 'refresh',
    ...options,
  })

test('value :: Token', t =>
  t.is(
    of({ value: 'qwerty' }).value,
    'qwerty',
    'value must equal to options.value',
  ))

test('expires :: Token', t =>
  t.deepEqual(
    of({ expires: Date.now() + 100 }).expires,
    new Date(Date.now() + 100),
    'expires must equal to options.expires',
  ))

test('warnFor :: Token', t =>
  t.is(
    of({ warnFor: 100500 }).warnFor,
    100500,
    'warnFor must equal to options.warnFor',
  ))

test('type :: Token', t =>
  t.is(
    of({ type: ('TYPE': any) }).type,
    'TYPE',
    'type must equal to options.type',
  ))

test.serial.cb('expired :: Token', t => {
  const token = of({
    expires: Date.now() + 100,
  })

  clock.setTimeout(
    () =>
      token
        .expired()
        .tapL(() =>
          t.fail(
            'must return Right(Token) when token not expired, but it returned Left(Error)',
          ),
        ),
    99,
  )

  clock.setTimeout(
    () =>
      token
        .expired()
        .tapL(() => t.end())
        .tap(() =>
          t.fail(
            'must return Left(Error) when token expired, but it returned Right(Token)',
          ),
        ),
    100,
  )

  clock.tick(100)
})
