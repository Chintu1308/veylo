import { Module } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseJwtStrategy } from './supabase-jwt.strategy';
import { ProjectsModule } from '../projects/projects.module';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PassportModule, ProjectsModule],
  controllers: [AuthController],
  providers: [AuthService, SupabaseService, SupabaseJwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
