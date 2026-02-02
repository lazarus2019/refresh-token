import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { swagger } from "@elysiajs/swagger";

// In-memory user store (replace with database in production)
const users = new Map<string, { id: string; username: string; password: string }>();
const refreshTokens = new Set<string>();

// Add a test user
users.set("admin", { id: "1", username: "admin", password: "password123" });

const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "JWT Authentication API",
          version: "1.0.0",
          description: "API with login and refresh token endpoints",
        },
        tags: [
          { name: "Auth", description: "Authentication endpoints" },
        ],
      },
    })
  )
  .use(
    jwt({
      name: "accessJwt",
      secret: process.env.ACCESS_TOKEN_SECRET || "access-secret-key-change-in-production",
      exp: "15m", // Access token expires in 15 minutes
    })
  )
  .use(
    jwt({
      name: "refreshJwt",
      secret: process.env.REFRESH_TOKEN_SECRET || "refresh-secret-key-change-in-production",
      exp: "7d", // Refresh token expires in 7 days
    })
  )
  .post(
    "/auth/login",
    async ({ body, accessJwt, refreshJwt }) => {
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

      return {
        success: true,
        message: "Login successful",
        data: {
          accessToken,
          refreshToken,
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
    }
  )
  .post(
    "/auth/refresh",
    async ({ body, accessJwt, refreshJwt }) => {
      const { refreshToken } = body;

      // Verify refresh token exists in store
      if (!refreshTokens.has(refreshToken)) {
        return {
          success: false,
          message: "Invalid refresh token",
        };
      }

      // Verify and decode refresh token
      const payload = await refreshJwt.verify(refreshToken);
      if (!payload) {
        // Remove invalid token from store
        refreshTokens.delete(refreshToken);
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
      refreshTokens.delete(refreshToken);
      refreshTokens.add(newRefreshToken);

      return {
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      };
    },
    {
      body: t.Object({
        refreshToken: t.String({ minLength: 1 }),
      }),
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
    }
  )
  .post(
    "/auth/logout",
    async ({ body }) => {
      const { refreshToken } = body;

      // Remove refresh token from store
      refreshTokens.delete(refreshToken);

      return {
        success: true,
        message: "Logged out successfully",
      };
    },
    {
      body: t.Object({
        refreshToken: t.String({ minLength: 1 }),
      }),
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
    }
  )
  .get(
    "/auth/me",
    async ({ headers, accessJwt }) => {
      const authHeader = headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return {
          success: false,
          message: "No token provided",
        };
      }

      const token = authHeader.split(" ")[1];
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
    }
  )
  .listen(3001);

console.log(
  `🦊 Server is running at ${app.server?.hostname}:${app.server?.port}`
);
console.log(
  `📚 Swagger documentation available at http://localhost:${app.server?.port}/swagger`
);
