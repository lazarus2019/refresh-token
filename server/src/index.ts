import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";

// In-memory user store (replace with database in production)
const users = new Map<
  string,
  { id: string; username: string; password: string }
>();
const refreshTokens = new Set<string>();

// Add a test user
users.set("admin", { id: "1", username: "admin", password: "password123" });



type ExpireMinute = `${number}m`;
type ExpireHour = `${number}h`;
type ExpireDay = `${number}d`;
type ExpireWeek = `${number}w`;

type ExpireTime = ExpireMinute | ExpireHour | ExpireDay | ExpireWeek;

const cookieConfigs: Record<string, {
  path: string,
  exp: ExpireTime
}> = {
  accessToken: {
    path: "/",
    exp: "1d", // Access token expires in 1 day
  },
  refreshToken: {
    path: "/auth/refresh", // only attach this cookie on prefix endpoint /auth/refresh
    exp: "7d", // Refresh token expires in 7 days
  },
};

const getExpiredTime = (time: ExpireTime) => {
  const type: string = time.charAt(time.length - 1);
  const value: number = Number(time.slice(0, -1));

  switch (type) {
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    case "w":
      return value * 60 * 60 * 24 * 7;
    default:
      return 60 * 60; // fallback to 1 hour
  }
};

const ACCESS_TOKEN_EXPIRED_TIME = getExpiredTime(cookieConfigs.accessToken.exp)
const REFRESH_TOKEN_EXPIRED_TIME = getExpiredTime(cookieConfigs.refreshToken.exp)


const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "JWT Authentication API",
          version: "1.0.0",
          description: "API with login and refresh token endpoints",
        },
        tags: [{ name: "Auth", description: "Authentication endpoints" }],
      },
    }),
  )
  .use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    }),
  )
  .use(
    jwt({
      name: "accessJwt",
      secret:
        process.env.ACCESS_TOKEN_SECRET ||
        "access-secret-key-change-in-production",
      exp: cookieConfigs.accessToken.exp, // Access token expires in 1 day
    }),
  )
  .use(
    jwt({
      name: "refreshJwt",
      secret:
        process.env.REFRESH_TOKEN_SECRET ||
        "refresh-secret-key-change-in-production",
      exp: cookieConfigs.refreshToken.exp, // Refresh token expires in 7 days
    }),
  )
  .post(
    "/auth/login",
    async ({
      body,
      accessJwt,
      refreshJwt,
      cookie: { access_token, refresh_token },
    }) => {
      const { username, password } = body;

      // Validate user credentials
      const user = users.get(username);
      if (!user || user.password !== password) {
        return {
          success: false,
          message: "Invalid username or password",
        };
      }

      // Generate tokens
      const accessToken = await accessJwt.sign({
        sub: user.id,
        username: user.username,
        type: "access",
      });

      const refreshToken = await refreshJwt.sign({
        sub: user.id,
        username: user.username,
        type: "refresh",
      });

      // Store refresh token
      refreshTokens.add(refreshToken);

      // Set HTTP-only cookies
      access_token.set({
        value: accessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ACCESS_TOKEN_EXPIRED_TIME, 
        path: cookieConfigs.accessToken.path,
      });

      refresh_token.set({
        value: refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: REFRESH_TOKEN_EXPIRED_TIME,
        path: cookieConfigs.refreshToken.path,
      });

      return {
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            username: user.username,
          },
        },
      };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
      detail: {
        tags: ["Auth"],
        summary: "User login",
        description: "Authenticate user and return access and refresh tokens",
        responses: {
          200: {
            description: "Login successful",
          },
        },
      },
    },
  )
  .post(
    "/auth/refresh",
    async ({
      cookie: { access_token, refresh_token },
      accessJwt,
      refreshJwt,
    }) => {
      const refreshTokenValue = refresh_token.value as string | undefined;

      // Verify refresh token exists
      if (!refreshTokenValue || !refreshTokens.has(refreshTokenValue)) {
        return {
          success: false,
          message: "Invalid refresh token",
        };
      }

      // Verify and decode refresh token
      const payload = await refreshJwt.verify(refreshTokenValue);
      if (!payload) {
        // Remove invalid token from store
        refreshTokens.delete(refreshTokenValue);
        refresh_token.remove();
        access_token.remove();
        return {
          success: false,
          message: "Invalid or expired refresh token",
        };
      }

      // Generate new access token
      const newAccessToken = await accessJwt.sign({
        sub: payload.sub as string,
        username: payload.username as string,
        type: "access",
      });

      // Optionally rotate refresh token
      const newRefreshToken = await refreshJwt.sign({
        sub: payload.sub as string,
        username: payload.username as string,
        type: "refresh",
      });

      // Remove old refresh token and add new one
      refreshTokens.delete(refreshTokenValue);
      refreshTokens.add(newRefreshToken);

      // Set new HTTP-only cookies
      access_token.set({
        value: newAccessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:ACCESS_TOKEN_EXPIRED_TIME,
        path: cookieConfigs.accessToken.path,
      });

      refresh_token.set({
        value: newRefreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: REFRESH_TOKEN_EXPIRED_TIME,
        path: cookieConfigs.refreshToken.path,
      });

      return {
        success: true,
        message: "Token refreshed successfully",
      };
    },
    {
      detail: {
        tags: ["Auth"],
        summary: "Refresh access token",
        description: "Use refresh token to obtain a new access token",
        responses: {
          200: {
            description: "Token refreshed successfully",
          },
        },
      },
    },
  )
  .post(
    "/auth/logout",
    async ({ cookie: { access_token, refresh_token } }) => {
      const refreshTokenValue = refresh_token.value as string | undefined;

      // Remove refresh token from store
      if (refreshTokenValue) {
        refreshTokens.delete(refreshTokenValue);
      }

      // Clear cookies
      access_token.remove();
      refresh_token.remove();

      return {
        success: true,
        message: "Logged out successfully",
      };
    },
    {
      detail: {
        tags: ["Auth"],
        summary: "User logout",
        description: "Invalidate refresh token",
        responses: {
          200: {
            description: "Logout successful",
          },
        },
      },
    },
  )
  .get(
    "/auth/me",
    async ({ cookie: { access_token }, accessJwt }) => {
      const token = access_token.value as string | undefined;
      if (!token) {
        return {
          success: false,
          message: "No token provided",
        };
      }

      const payload = await accessJwt.verify(token);

      if (!payload) {
        return {
          success: false,
          message: "Invalid or expired token",
        };
      }

      const user = users.get(payload.username as string);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      return {
        success: true,
        data: {
          id: user.id,
          username: user.username,
        },
      };
    },
    {
      detail: {
        tags: ["Auth"],
        summary: "Get current user",
        description: "Get authenticated user information",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "User information retrieved",
          },
        },
      },
    },
  )
  .listen(3001);

console.log(
  `🦊 Server is running at ${app.server?.hostname}:${app.server?.port}`,
);
console.log(
  `📚 Swagger documentation available at http://localhost:${app.server?.port}/swagger`,
);
