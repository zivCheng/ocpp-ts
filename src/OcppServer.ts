/* eslint-disable @typescript-eslint/no-useless-constructor */
import { SecureContextOptions } from 'tls';
import { IncomingMessage } from 'http';
import { Server } from './impl/Server';
import { OcppClientConnection } from './OcppClientConnection';
import { ServerOptions } from './impl/ServerOptions';

export class OcppServer extends Server {
  constructor(options: ServerOptions) {
    super(options);
  }

  listen(port: number = 9220, options?: SecureContextOptions) {
    super.listen(port, options);
  }

  on(
    event: 'authorization',
    listener: (cpId: string, req: IncomingMessage, cb: (err?: Error) => void) => void
  ): this;
  on(event: 'connection', listener: (client: OcppClientConnection) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void) {
    return super.on(event, listener);
  }
}
