# zentoken

[![Build Status][status-img]][status-url]
[![Coverage Status][cover-img]][cover-url]
[![Greenkeeper badge](https://badges.greenkeeper.io/bigslycat/zentoken.svg)](https://greenkeeper.io/)

Authentication like a zen.

Zentoken is an authentication status manager based on a standard two-token
scheme (access token and refresh token). Zentoken keeps track of expiring tokens
and updates them. Do not complicate your apps. Use fetch, Axios, etc. as if
authentication is not needed.

`yarn add zentoken` or `npm install --save zentoken`

## Usage

You need to create `Zen` instance first:

```js
import { Zen } from 'zentoken'

const zen = new Zen({
  // How many milliseconds before the expiration
  // do you need to update the token?
  refreshOffset: 60000,

  // Implementation of authentication request
  login(login, password) {
    return fetch('/api/refresh-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    }).then(response => response.json())
  },

  // Implementation of fetch refresh token request
  fetchRefreshToken(refreshToken) {
    return fetch('/api/refresh-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).then(response => response.json())
  },

  // Implementation of fetch access token request
  fetchAccessToken(refreshToken) {
    return fetch('/api/access-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).then(response => response.json())
  },
})

zen.on('login success', saveRefreshToken)
zen.on('auth by token success', saveRefreshToken)
zen.on('token refresh', saveRefreshToken)

function saveRefreshToken(refreshToken) {
  sessionStorage.setItem('refreshToken', refreshToken.value)
}

const refreshToken = sessionStorage.getItem('refreshToken')

if (refreshToken) {
  zen
    .authByToken(refreshToken)
    .catch(console.error)
}
```

And now you can log in:

```js
zen
  .login('vasya', 'qwerty')
  .catch(console.error)
```

If you use fetch:

```js
const fetch = zen.wrapFetch((accessTokenValue, headers) =>
  headers.set('Authorization', `Bearer ${accessTokenValue}`),
)
```

If you use Axios:

```js
const zenInterceptor = zen.axios((accessTokenValue, headers) =>
  headers.set('Authorization', `Bearer ${accessTokenValue}`),
)

axios.interceptors.request.use(zenInterceptor)
```

## API

WIP.

[status-url]: https://travis-ci.org/bigslycat/zentoken
[status-img]: https://travis-ci.org/bigslycat/zentoken.svg?branch=master
[cover-url]: https://coveralls.io/github/bigslycat/zentoken?branch=master
[cover-img]: https://coveralls.io/repos/github/bigslycat/zentoken/badge.svg?branch=master
