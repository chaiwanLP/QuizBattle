import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/**
 * The HTTP server's CORS config does not apply to the Socket.IO server, so the
 * trusted origins have to be passed to the adapter explicitly. Credentials are
 * required because hosts authenticate their socket with the session cookie.
 */
export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(
    port: number | undefined,
    options?: ServerOptions,
  ): Server {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins, credentials: true },
    } as ServerOptions);
  }
}
