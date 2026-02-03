const authEndpoint = {
    refreshToken: (originalUrl: string = globalThis.location.href) => `auth/refresh?originalUrl=${encodeURIComponent(originalUrl)}`,
    login: 'auth/login',
    logout: 'auth/logout',
    getMe: 'auth/me',
} as const

export {authEndpoint}