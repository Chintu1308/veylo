import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseService } from '../common/supabase.service';
import { EventsGateway } from '../events/events.gateway';
import type { Device, DeviceHistory, RegisterDeviceRequest } from '@veylo/shared';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @Inject(SupabaseService)
    private readonly supabase: SupabaseService,
    @Inject(EventsGateway)
    private readonly eventsGateway: EventsGateway,
  ) {}

  async listDevices(projectId: string): Promise<Device[]> {
    const { data, error } = await this.supabase.admin
      .from('devices')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      this.logger.error(`Error listing devices for project ${projectId}`, error.message);
      return [];
    }
    return (data ?? []) as Device[];
  }

  async getDevice(projectId: string, deviceId: string): Promise<Device | null> {
    const { data, error } = await this.supabase.admin
      .from('devices')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', deviceId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error getting device ${deviceId}`, error.message);
      return null;
    }
    return data as Device | null;
  }

  async registerDevice(
    projectId: string,
    userId: string,
    req: RegisterDeviceRequest,
  ): Promise<Device> {
    const { data, error } = await this.supabase.admin
      .from('devices')
      .insert({
        project_id: projectId,
        user_id: userId,
        name: req.name,
        os: req.os,
        status: 'pending',
        posture_score: 100,
        last_seen_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Device registration failed: ${error?.message}`);
    }

    await this.supabase.admin.from('device_history').insert({
      device_id: data.id,
      posture_score: 100,
      details: { info: 'Device registered' },
    });

    this.eventsGateway.broadcastToProject(projectId, 'device.updated', data);
    return data as Device;
  }

  async updatePostureScore(
    projectId: string,
    deviceId: string,
    score: number,
    details: Record<string, any>,
  ): Promise<Device> {
    const { data: device, error: checkErr } = await this.supabase.admin
      .from('devices')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', deviceId)
      .single();

    if (checkErr || !device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    let finalStatus = device.status;
    if (score < 30 && device.status === 'approved') {
      finalStatus = 'blocked';
      this.logger.warn(`Device ${deviceId} posture score critical (${score}). Automatically quarantining.`);
    }

    const { data, error } = await this.supabase.admin
      .from('devices')
      .update({
        posture_score: score,
        status: finalStatus,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', deviceId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update posture score: ${error?.message}`);
    }

    await this.supabase.admin.from('device_history').insert({
      device_id: deviceId,
      posture_score: score,
      details,
    });

    this.eventsGateway.broadcastToProject(projectId, 'device.updated', data);
    return data as Device;
  }

  async updateDeviceStatus(
    projectId: string,
    deviceId: string,
    status: 'approved' | 'pending' | 'blocked',
  ): Promise<Device> {
    const { data, error } = await this.supabase.admin
      .from('devices')
      .update({ status })
      .eq('project_id', projectId)
      .eq('id', deviceId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update device status: ${error?.message}`);
    }
    
    this.eventsGateway.broadcastToProject(projectId, 'device.updated', data);
    return data as Device;
  }

  async updateDeviceName(
    projectId: string,
    deviceId: string,
    name: string,
  ): Promise<Device> {
    const { data, error } = await this.supabase.admin
      .from('devices')
      .update({ name })
      .eq('project_id', projectId)
      .eq('id', deviceId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to update device name: ${error?.message}`);
    }
    
    this.eventsGateway.broadcastToProject(projectId, 'device.updated', data);
    return data as Device;
  }

  async deleteDevice(projectId: string, deviceId: string): Promise<void> {
    const { error } = await this.supabase.admin
      .from('devices')
      .delete()
      .eq('project_id', projectId)
      .eq('id', deviceId);

    if (error) {
      throw new Error(`Failed to delete device: ${error.message}`);
    }

    this.eventsGateway.broadcastToProject(projectId, 'device.deleted', { id: deviceId });
  }
}
