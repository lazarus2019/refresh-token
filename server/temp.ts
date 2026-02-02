public async renewToken(
    @Cookies(COOKIE_RT) refreshToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CoreApiResponse<TokenResponse, HttpException>> {
    try {
      const tokenResponse = await this._authService.refreshToken(refreshToken)
      res.cookie(COOKIE_AT, tokenResponse.accessToken, this._atCookieOption)
      res.cookie(COOKIE_RT, tokenResponse.refreshToken, this._rtCookieOption)
      return CoreApiResponse.success(tokenResponse)
    } catch (err) {
      res.clearCookie(COOKIE_AT, this._atCookieOption)
      res.clearCookie(COOKIE_RT, this._rtCookieOption)
      throw err
    }
  }


   public async refreshToken(oldRefreshToken: string): Promise<TokenResponse> {
    try {
      const payload = await this._jwtService.verifyAsync(oldRefreshToken, {
        secret: SECRET_KEY,
      })

      const refreshBlacklistKey = redisKeys.BLACKLIST_KEY(payload.jti)

      const isBlacklistedBefore = !!(await this._cacheService.get(refreshBlacklistKey))
      if (isBlacklistedBefore) throw Error

      await this._cacheService.set(refreshBlacklistKey, 'true')

      const encodedProfile: TokenGenerateRequest = {
        name: payload.name,
        mail: payload.mail,
        age: payload.age,
        class: payload.class,
        exp: payload.exp,
      }
      return await this._authHelper.generateTokens(encodedProfile)
    } catch {
      throw new UnauthorizedException(errorAuth.refreshTokenFail)
    }
  }