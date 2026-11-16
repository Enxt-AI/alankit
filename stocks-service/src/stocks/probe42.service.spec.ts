import {
  createServer,
  Server,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { Probe42Service } from './probe42.service';

// Exercise native fetch over HTTP, including broken connections and body reads.
describe('Probe42 document transport', () => {
  let server: Server;
  let service: Probe42Service;
  let calls: number;
  let handler: (req: IncomingMessage, res: ServerResponse) => void;
  const pdf = Buffer.from('%PDF-1.4\nfixture\n%%EOF');

  beforeEach(async () => {
    calls = 0;
    handler = (_req, res) => {
      res.end(pdf);
    };
    server = createServer((req, res) => {
      calls++;
      handler(req, res);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    service = new Probe42Service(
      new ConfigService({
        PROBE42_API_KEY: 'test-only',
        PROBE42_REPORTS_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/probe_reports`,
      }),
    );
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('preserves document bytes, encoded IDs and provider headers', async () => {
    handler = (req, res) => {
      const url = new URL(req.url!, 'http://localhost');
      expect(url.pathname).toBe(
        '/probe_reports/companies/ABC/get-reference-document-by-id',
      );
      expect(url.searchParams.get('doc-id')).toBe('folder/a b&c.pdf');
      expect(req.headers['x-api-key']).toBe('test-only');
      expect(req.headers['x-api-version']).toBe('1.3');
      res.end(pdf);
    };
    expect(await service.getCompanyDocument('abc', 'folder/a b&c.pdf')).toEqual(
      pdf,
    );
    expect(calls).toBe(1);
  });

  it('retries a dropped connection once', async () => {
    handler = (req, res) => (calls === 1 ? req.socket.destroy() : res.end(pdf));
    expect(await service.getCompanyDocument('ABC', 'doc')).toEqual(pdf);
    expect(calls).toBe(2);
  });

  it('retries a temporary 503', async () => {
    handler = (_req, res) => {
      res.statusCode = calls === 1 ? 503 : 200;
      res.end(pdf);
    };
    expect(await service.getCompanyDocument('ABC', 'doc')).toEqual(pdf);
    expect(calls).toBe(2);
  });

  it('returns 502 after two failed connections and allows a later retry', async () => {
    handler = (req) => {
      req.socket.destroy();
    };
    await expect(
      service.getCompanyDocument('ABC', 'doc'),
    ).rejects.toMatchObject({ status: 502 });
    expect(calls).toBe(2);
    handler = (_req, res) => {
      res.end(pdf);
    };
    expect(await service.getCompanyDocument('ABC', 'doc')).toEqual(pdf);
    expect(calls).toBe(3);
  });

  it.each([401, 404, 429])(
    'does not retry provider status %s',
    async (status) => {
      handler = (_req, res) => {
        res.statusCode = status;
        res.end('provider failure');
      };
      await expect(
        service.getCompanyDocument('ABC', 'doc'),
      ).rejects.toMatchObject({ status: 502 });
      expect(calls).toBe(1);
    },
  );

  it('shares concurrent downloads without retaining a PDF cache', async () => {
    const results = await Promise.all([
      service.getCompanyDocument('abc', 'doc'),
      service.getCompanyDocument('ABC', 'doc'),
    ]);
    expect(results).toEqual([pdf, pdf]);
    expect(calls).toBe(1);
    await service.getCompanyDocument('ABC', 'doc');
    expect(calls).toBe(2);
  });

  it('bounds a hanging provider and returns 504 after one retry', async () => {
    handler = () => {};
    await expect(
      service.getCompanyDocument('ABC', 'doc'),
    ).rejects.toMatchObject({ status: 504 });
    expect(calls).toBe(2);
  }, 45_000);
});
