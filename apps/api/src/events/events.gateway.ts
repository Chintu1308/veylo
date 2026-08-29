import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinProject')
  handleJoinProject(
    @MessageBody('projectId') projectId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`project_${projectId}`);
    this.logger.log(`Client ${client.id} joined project_${projectId}`);
    return { event: 'joined', data: projectId };
  }

  @SubscribeMessage('leaveProject')
  handleLeaveProject(
    @MessageBody('projectId') projectId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`project_${projectId}`);
    this.logger.log(`Client ${client.id} left project_${projectId}`);
    return { event: 'left', data: projectId };
  }

  // Utility method for services to broadcast
  broadcastToProject(projectId: string, event: string, payload: any) {
    this.server.to(`project_${projectId}`).emit(event, payload);
  }
}
