import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { cloudflareClientIp, isCloudflareIp, resolveClientIp } from '../lib/clientIp';

describe('IP del cliente detrás de Cloudflare', () => {
  it('reconoce rangos de Cloudflare (IPv4, IPv6 y IPv4 mapeada) y rechaza el resto', () => {
    expect(isCloudflareIp('172.69.10.20')).toBe(true);
    expect(isCloudflareIp('188.114.96.3')).toBe(true);
    expect(isCloudflareIp('2606:4700:3030::6815:1')).toBe(true);
    expect(isCloudflareIp('::ffff:104.16.1.1')).toBe(true);
    expect(isCloudflareIp('203.0.113.9')).toBe(false);
    expect(isCloudflareIp('49.13.19.148')).toBe(false);
    expect(isCloudflareIp('no-es-una-ip')).toBe(false);
    expect(isCloudflareIp(undefined)).toBe(false);
  });

  it('usa CF-Connecting-IP solo si la conexión viene de Cloudflare', () => {
    expect(resolveClientIp('172.69.10.20', '198.51.100.7')).toBe('198.51.100.7');
    expect(resolveClientIp('172.69.10.20', ' 2001:db8::5 ')).toBe('2001:db8::5');
    expect(resolveClientIp('::ffff:172.69.10.20', '::ffff:198.51.100.7')).toBe('198.51.100.7');
    // Llamada directa al origen: la cabecera es falsificable y se ignora.
    expect(resolveClientIp('203.0.113.9', '198.51.100.7')).toBe('203.0.113.9');
  });

  it('con cabecera ausente o inválida desde Cloudflare conserva la IP de la conexión', () => {
    expect(resolveClientIp('172.69.10.20', undefined)).toBe('172.69.10.20');
    expect(resolveClientIp('172.69.10.20', 'basura')).toBe('172.69.10.20');
    expect(resolveClientIp('172.69.10.20', ['198.51.100.7', '198.51.100.8'])).toBe('172.69.10.20');
  });

  describe('middleware', () => {
    let server: Server;
    let base: string;
    beforeAll(async () => {
      const app = express();
      app.set('trust proxy', 1);
      app.use(cloudflareClientIp);
      app.get('/ip', (req, res) => res.json({ ip: req.ip }));
      server = app.listen(0);
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterAll(() => new Promise((r) => server.close(() => r(undefined))));

    const ipDe = async (headers: Record<string, string>) => ((await (await fetch(`${base}/ip`, { headers })).json()) as { ip: string }).ip;

    it('req.ip pasa a ser la del cliente real cuando el salto anterior es Cloudflare', async () => {
      expect(await ipDe({ 'x-forwarded-for': '172.69.10.20', 'cf-connecting-ip': '198.51.100.7' })).toBe('198.51.100.7');
    });

    it('no se puede falsear llamando directo al origen', async () => {
      expect(await ipDe({ 'x-forwarded-for': '203.0.113.9', 'cf-connecting-ip': '198.51.100.7' })).toBe('203.0.113.9');
    });

    it('un X-Forwarded-For falso delante de la IP de Cloudflare no cuela', async () => {
      expect(await ipDe({ 'x-forwarded-for': '1.2.3.4, 172.69.10.20', 'cf-connecting-ip': '198.51.100.7' })).toBe('198.51.100.7');
    });
  });
});
