/* @flow */

import EventEmitter from 'events'

import * as i from 'igogo'

import { getSet } from './getSet'

const [getValue, setValue] = getSet('value')
const [getExpires, setExpires] = getSet('expires')
const [getWarnFor, setWarnFor] = getSet('warnFor')
const [getType, setType] = getSet('type')
const [getEmitter, setEmitter] = getSet('emitter')

// eslint-disable-next-line
const [getExpired, setExpired] = getSet/* :: <i.Either<Error, Token>> */('expired')

const getTimeOffset = (date: Date, before: number = 0) =>
  Math.max(0, date.getTime() - Date.now() - before)

type EventName = 'warn' | 'expire'

interface TokenEmitter {
  setMaxListeners(count: number): TokenEmitter;
  on(eventName: EventName, listener: (Token) => mixed): TokenEmitter;
  addListener(eventName: EventName, listener: (Token) => mixed): TokenEmitter;
  once(eventName: EventName, listener: (Token) => mixed): TokenEmitter;

  off(eventName: EventName, listener: (Token) => mixed): TokenEmitter;
  removeListener(
    eventName: EventName,
    listener: (Token) => mixed,
  ): TokenEmitter;

  removeAllListeners(eventName?: EventName): TokenEmitter;

  emit(eventName: EventName, token: Token): boolean;

  eventNames(): $ReadOnlyArray<EventName>;

  listeners(eventName: EventName): $ReadOnlyArray<(Token) => mixed>;
}

const createEmitter = (): TokenEmitter => (new EventEmitter(): any)

export type Type = 'access' | 'refresh'

export type Data = {
  value: string,
  expires: string | number | Date,
}

export type Options = {
  value: string,
  expires: string | number | Date,
  warnFor: number,
  type: Type,
}

const expiredError = token =>
  i.Left(new Error(`${getType(token)} token ${getValue(token)} expired`))

export class Token {
  static of(options: Options): Token {
    return new Token(options)
  }

  constructor(options: Options) {
    setValue(this, options.value)
    setExpires(this, new Date(options.expires))
    setExpired(this, i.Right(this))
    setWarnFor(this, options.warnFor)
    setType(this, options.type)

    const emitter = setEmitter(this, createEmitter()).setMaxListeners(Infinity)

    setTimeout(() => {
      setExpired(this, expiredError(this))
      emitter.emit('expire', this)
    }, getTimeOffset(getExpires(this)))

    setTimeout(
      () => emitter.emit('warn', this),
      getTimeOffset(getExpires(this), options.warnFor),
    )
  }

  get value(): string {
    return getValue(this)
  }

  get expires(): Date {
    return getExpires(this)
  }

  get warnFor(): number {
    return getWarnFor(this)
  }

  get type(): Type {
    return getType(this)
  }

  expired(): i.Either<Error, Token> {
    return getExpired(this)
  }

  on(eventName: EventName, listener: Token => mixed): Token {
    getEmitter(this).on(eventName, listener)
    return this
  }

  off(eventName: EventName, listener: Token => mixed): Token {
    getEmitter(this).off(eventName, listener)
    return this
  }

  removeAllListeners(eventName?: EventName): Token {
    getEmitter(this).removeAllListeners(eventName)
    return this
  }

  toData() {
    return {
      value: this.value,
      expires: this.expires,
      type: this.type,
    }
  }

  toJS() {
    return {
      value: this.value,
      expires: this.expires,
      warnFor: this.warnFor,
      type: this.type,
    }
  }

  toJSON() {
    return {
      value: this.value,
      expires: +this.expires,
      warnFor: this.warnFor,
      type: this.type,
    }
  }
}

export const { of } = Token

export const value = (token: Token) => token.value
export const expired = (token: Token) => token.expired()

export const removeAllListeners = (eventName?: EventName) => (token: Token) =>
  token.removeAllListeners(eventName)
