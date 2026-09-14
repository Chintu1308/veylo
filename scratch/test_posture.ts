import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module';
import { DevicesService } from '../apps/api/src/devices/devices.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const devicesService = app.get(DevicesService);
  const projectId = '6fcf42e3-9c90-48c5-9228-4972157897bb';
  const userId = 'test-user';
  
  // 1. Register device
  const device = await devicesService.registerDevice(projectId, userId, { name: 'test', os: 'linux' });
  console.log('Registered Device:', device);
  
  // 2. Update posture
  const updatedDevice = await devicesService.updatePostureScore(projectId, device.id, 100, {});
  console.log('Updated Device:', updatedDevice);
  
  // 3. List devices
  const devices = await devicesService.listDevices(projectId);
  console.log('Listed Devices:', devices);
  
  await app.close();
}
bootstrap();
