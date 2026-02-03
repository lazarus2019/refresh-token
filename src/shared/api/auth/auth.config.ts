const authEndpoint = {
    refreshToken: (originalUrl: string = globalThis.location.href) => `${originalUrl}/auth/refresh`,
    login: 'auth/login',
    logout: 'auth/logout',
    getMe: 'auth/me',
} as const

export {authEndpoint}