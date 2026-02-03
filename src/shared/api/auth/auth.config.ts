const authEndpoint = {
    refreshToken: (originalUrl: string = globalThis.location.href) => `${originalUrl}/auth/refresh`,
    login: 'auth/login',
    logout: 'auth/logout'
} as const

export {authEndpoint}