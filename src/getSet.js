/* @flow */

export type GetSet<T> = [(Object) => T, (Object, T) => T]

export const getSet = <T>(keyName?: string): GetSet<T> => {
  const key = Symbol(keyName)
  return [
    instance => instance[key],
    // eslint-disable-next-line no-param-reassign
    (instance, value) => (instance[key] = value),
  ]
}
