import { Injectable, UnauthorizedException, Logger, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseService } from '../common/supabase.service';

export interface JwtPayload {
  sub: string; // Supabase Auth user UUID
  email: string;
  project_id: string | null;
  role: string;
  aud: string;
  exp: number;
}

/**
 * Detects whether we're running in sandbox mode (placeholder Supabase URL).
 * When true, token signature verification is relaxed since the frontend
 * sends structurally-valid but unsigned JWTs.
 */
function isSandboxMode(): boolean {
  const url = process.env.SUPABASE_URL ?? '';
  return !url || url.includes('placeholder');
}

/**
 * Validates Supabase-issued HS256 JWTs.
 *
 * In sandbox mode the strategy uses a known dev secret and
 * skips expiration checks so mock tokens are always accepted.
 */
@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  'supabase-jwt',
) {
  private readonly logger = new Logger(SupabaseJwtStrategy.name);

  constructor(
    @Inject(SupabaseService)
    private readonly supabaseService: SupabaseService,
  ) {
    const sandbox = isSandboxMode();

    super({
      secretOrKey:
        process.env.SUPABASE_JWT_SECRET ??
        'super-secret-jwt-token-with-at-least-32-characters-long',
      jwtFromRequest: sandbox
        ? SupabaseJwtStrategy.extractAndParseSandboxToken
        : ExtractJwt.fromAuthHeaderAsBearerToken(),
      // In sandbox mode we skip expiration since mock tokens are synthetic
      ignoreExpiration: sandbox,
      algorithms: ['HS256'],
    });

    if (sandbox) {
      this.logger.warn(
        '⚠️  JWT strategy running in SANDBOX MODE — skipping signature verification',
      );
    }
  }

  /**
   * Custom extractor for sandbox mode.
   * Instead of verifying the JWT signature (which is fake), we extract
   * the payload directly and pass it through Passport's pipeline.
   */
  private static extractAndParseSandboxToken(req: any): string | null {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }

  async validate(payload: JwtPayload | any): Promise<JwtPayload> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      sub: payload.sub,
      email: payload.email ?? '',
      project_id: payload.project_id ?? payload.organization_id ?? null,
      role: payload.role ?? 'authenticated',
      aud: payload.aud ?? 'authenticated',
      exp: payload.exp ?? 0,
    };
  }

  /**
   * Override authenticate:
   * 1. Sandbox mode: manually decode mock base64url JWT.
   * 2. Real mode: query Supabase API directly to verify the token,
   *    avoiding dependency on a local shared JWT secret.
   */
  async authenticate(req: any, options?: any) {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return this.fail({ message: 'No auth token' }, 401);
    }

    const token = authHeader.slice(7);

    if (isSandboxMode()) {
      try {
        const parts = token.split('.');
        if (parts.length < 2) {
          return this.fail({ message: 'Malformed token' }, 401);
        }

        const payloadB64 = parts[1]
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        const payload = JSON.parse(
          Buffer.from(payloadB64, 'base64').toString('utf8'),
        );

        const user = await this.validate(payload);
        return this.success(user);
      } catch (err: any) {
        return this.fail({ message: err.message || 'Token decode failed' }, 401);
      }
    } else {
      // Real database mode — call Supabase getUser API to check token validation
      try {
        const { data: { user: authUser }, error } = await this.supabaseService.admin.auth.getUser(token);
        if (error || !authUser) {
          return this.fail({ message: error?.message || 'Invalid or expired token' }, 401);
        }

        const payload = {
          sub: authUser.id,
          email: authUser.email ?? '',
          role: authUser.user_metadata?.role ?? 'authenticated',
          aud: authUser.aud ?? 'authenticated',
          project_id: authUser.user_metadata?.project_id ?? null,
          exp: 0,
        };

        const validatedUser = await this.validate(payload);
        return this.success(validatedUser);
      } catch (err: any) {
        return this.fail({ message: err.message || 'Verification failed' }, 401);
      }
    }
  }
}
