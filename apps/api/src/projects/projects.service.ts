import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import type { Project, ProjectMember } from '@veylo/shared';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @Inject(SupabaseService)
    private readonly supabase: SupabaseService,
  ) {}

  async listProjects(userId: string): Promise<Project[]> {
    // Select projects owned by user
    const ownedRes = await this.supabase.admin
      .from('projects')
      .select('*')
      .eq('owner_id', userId);

    // Select projects where user is collaborator
    const memberRes = await this.supabase.admin
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId)
      .eq('status', 'active');

    const projectIds = (memberRes.data ?? []).map((m: any) => m.project_id);
    let collaboratedProjects: any[] = [];
    
    if (projectIds.length > 0) {
      const colRes = await this.supabase.admin
        .from('projects')
        .select('*')
        .in('id', projectIds);
      collaboratedProjects = colRes.data ?? [];
    }

    const all = [...(ownedRes.data ?? []), ...collaboratedProjects];
    // Remove duplicate project records if any
    const unique = Array.from(new Map(all.map((p) => [p.id, p])).values());
    return unique as Project[];
  }

  async getProject(projectId: string): Promise<Project | null> {
    const { data, error } = await this.supabase.admin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error getting project ${projectId}`, error.message);
      return null;
    }
    return data as Project | null;
  }

  async getProjectBySlug(slug: string): Promise<Project | null> {
    const { data, error } = await this.supabase.admin
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error getting project by slug ${slug}`, error.message);
      return null;
    }
    return data as Project | null;
  }

  async createProject(
    name: string,
    slug: string,
    description: string | undefined,
    ownerId: string,
  ): Promise<Project> {
    const { data: project, error: projErr } = await this.supabase.admin
      .from('projects')
      .insert({
        owner_id: ownerId,
        name,
        slug,
        description: description ?? null,
      })
      .select('*')
      .single();

    if (projErr || !project) {
      throw new Error(projErr?.message ?? 'Failed to create project');
    }

    // Add owner as founding project_admin in project_members
    const { error: memberErr } = await this.supabase.admin
      .from('project_members')
      .insert({
        project_id: project.id,
        user_id: ownerId,
        role: 'project_admin',
        status: 'active',
      });

    if (memberErr) {
      // Compensating action: roll back project
      await this.supabase.admin.from('projects').delete().eq('id', project.id);
      throw new Error(`Collaborator mapping failed: ${memberErr.message}`);
    }

    return project as Project;
  }

  async updateSettings(
    projectId: string,
    name: string,
    description: string | undefined,
  ): Promise<Project> {
    const { data, error } = await this.supabase.admin
      .from('projects')
      .update({
        name,
        description: description ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update project settings: ${error?.message}`);
    }
    return data as Project;
  }

  // ── Collaborator Members ───────────────────────────────────────────────────
  async listMembers(projectId: string): Promise<any[]> {
    const { data: memberships, error } = await this.supabase.admin
      .from('project_members')
      .select('*')
      .eq('project_id', projectId);

    if (error || !memberships) {
      this.logger.error(`Error listing project members for ${projectId}`, error?.message);
      return [];
    }

    const userIds = memberships.map((m) => m.user_id);
    const { data: profiles } = await this.supabase.admin
      .from('users')
      .select('id, display_name')
      .in('id', userIds);

    const { data: authUsers } = await this.supabase.admin.auth.admin.listUsers();
    const emailMap = new Map<string, string>();
    authUsers?.users?.forEach((u) => {
      emailMap.set(u.id, u.email ?? '');
    });

    const profileMap = new Map<string, any>();
    profiles?.forEach((p) => {
      profileMap.set(p.id, p);
    });

    return memberships.map((m) => {
      const p = profileMap.get(m.user_id);
      return {
        id: m.user_id,
        membership_id: m.id,
        email: emailMap.get(m.user_id) ?? 'unknown@veylo.io',
        display_name: p?.display_name ?? null,
        role: m.role,
        status: m.status,
        created_at: m.created_at,
      };
    });
  }

  async addMember(
    projectId: string,
    email: string,
    role: 'project_admin' | 'security_analyst' | 'protected_user',
  ): Promise<ProjectMember> {
    // Resolve user by email from profiles (mockUsers in sandbox, auth in real)
    const { data: users, error: userErr } = await this.supabase.admin
      .from('users')
      .select('id')
      .ilike('display_name', email.split('@')[0])
      .limit(1);

    if (userErr || !users || users.length === 0) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const userId = users[0].id;

    const { data: member, error } = await this.supabase.admin
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        role,
        status: 'active',
      })
      .select('*')
      .single();

    if (error || !member) {
      throw new Error(`Failed to add project collaborator: ${error?.message}`);
    }
    return member as ProjectMember;
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    // Cannot remove project owner
    const { data: project } = await this.supabase.admin
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .single();

    if (project && project.owner_id === userId) {
      throw new Error('Cannot remove project owner from collaborators');
    }

    const { error } = await this.supabase.admin
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to remove collaborator: ${error.message}`);
    }
  }

  async verifyProjectCollaborator(
    projectId: string,
    userId: string,
    allowedRoles?: string[],
  ): Promise<boolean> {
    // Owner bypasses collaborator check
    const project = await this.getProject(projectId);
    if (project && project.owner_id === userId) {
      return true;
    }

    const { data: member } = await this.supabase.admin
      .from('project_members')
      .select('role, status')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!member || member.status !== 'active') {
      return false;
    }

    if (allowedRoles && !allowedRoles.includes(member.role)) {
      return false;
    }

    return true;
  }
}
