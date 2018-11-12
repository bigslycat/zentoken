/* @flow */

import test from 'ava'

import * as Token from './Token'

const expiresOffset = 1000
const expires = new Date(Date.now() + expiresOffset)
const warnFor = 500
const value = 'VALUE'
const type = ('TYPE': any)

const of = (options: $Shape<Token.Options>) =>
  Token.of({ value, expires, warnFor, type, ...options })

test('value :: Token', t =>
  t.is(of().value, value, 'value must equal to options.value'))

test('expires :: Token', t =>
  t.deepEqual(of().expires, expires, 'expires must equal to options.expires'))

test('warnFor :: Token', t =>
  t.is(of().warnFor, warnFor, 'warnFor must equal to options.warnFor'))

test('type :: Token', t =>
  t.is(of().type, type, 'type must equal to options.type'))

test.cb('expired :: Token', t => {
  const token = of()

  setTimeout(
    () =>
      token
        .expired()
        .tapL(() =>
          t.fail(
            'must return Right(Token) when token not expired, but it returned Left(Error)',
          ),
        ),
    expiresOffset - 50,
  )

  setTimeout(
    () =>
      token
        .expired()
        .tapL(() => t.end())
        .tap(() =>
          t.fail(
            'must return Left(Error) when token expired, but it returned Right(Token)',
          ),
        ),
    expiresOffset + 50,
  )
})
