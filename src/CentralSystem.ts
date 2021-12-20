import EventEmitter from 'events';
import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage, createServer } from 'http';
import stream from 'node:stream';
import { Protocol } from './Protocol';
import { Client } from './Client';
import { OCPP_PROTOCOL_1_6 } from './schemas';

export class CentralSystem extends EventEmitter {
  server: WebSocket.Server | null = null;

  clients: Array<Client> = [];

  listen(port = 9220) {
    const server = createServer();
    const wss = new WebSocketServer({
      noServer: true,
      handleProtocols: (protocols: Set<string>) => {
        if (protocols.has(OCPP_PROTOCOL_1_6)) {
          return OCPP_PROTOCOL_1_6;
        }
        return false;
      },
    });

    wss.on('connection', (ws, req) => this.onNewConnection(ws, req));

    server.on('upgrade', (req: IncomingMessage, socket: stream.Duplex, head: Buffer) => {
      const cpId = CentralSystem.getCpIdFromUrl(req.url);
      if (!cpId) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
      } else if (this.listenerCount('authorization')) {
        this.emit('authorization', cpId, req, (err?: Error) => {
          if (err) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
          } else {
            wss.handleUpgrade(req, socket, head, (ws) => {
              wss.emit('connection', ws, req);
            });
          }
        });
      } else {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    });

    server.listen(port);
  }

  onNewConnection(socket: WebSocket, req: IncomingMessage) {
    const cpId = CentralSystem.getCpIdFromUrl(req.url);
    if (!socket.protocol || !cpId) {
      // From Spec: If the Central System does not agree to using one of the subprotocols offered
      // by the client, it MUST complete the WebSocket handshake with a response without a
      // Sec-WebSocket-Protocol header and then immediately close the WebSocket connection.
      console.info('Closed connection due to unsupported protocol');
      socket.close();
      return;
    }

    socket.on('error', (err) => {
      console.info(err.message, socket.readyState);
    });

    const client = new Client(cpId);
    client.setConnection(new Protocol(client, socket));
    socket.on('close', (code: number, reason: Buffer) => {
      const index = this.clients.indexOf(client);
      this.clients.splice(index, 1);
      client.emit('close', code, reason);
      this.emit('close', client, code, reason);
    });
    this.clients.push(client);
    this.emit('connection', client);
  }

  static getCpIdFromUrl(url: string | undefined): string | undefined {
    if (url) {
      const parts = decodeURI(url)
      .split('/')
      .filter((item) => item);
      return parts[parts.length - 1];
    }
    return undefined;
  }
}
