import { BlockList, isIP } from 'node:net';
import type { RequestHandler } from 'express';

/**
 * IP real del cliente detrás de Cloudflare.
 *
 * Con Cloudflare por delante, `req.ip` es la IP del borde de Cloudflare (la comparten miles de
 * clientes) y los límites por IP, las sesiones y la auditoría verían todos la misma. La IP real
 * llega en `CF-Connecting-IP`, pero esa cabecera solo es fiable si la conexión viene de
 * Cloudflare: el origen también responde por IP directa y cualquiera podría falsearla. Por eso
 * solo se usa cuando `req.ip` (ya resuelta por `trust proxy`) cae en un rango de Cloudflare.
 *
 * Rangos: https://www.cloudflare.com/ips-v4 y https://www.cloudflare.com/ips-v6 (cambian muy
 * rara vez; revisarlos de vez en cuando).
 */
const CLOUDFLARE_V4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
];
const CLOUDFLARE_V6 = [
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
];

const cloudflare = new BlockList();
for (const cidr of CLOUDFLARE_V4) {
  const [net, bits] = cidr.split('/');
  cloudflare.addSubnet(net, Number(bits), 'ipv4');
}
for (const cidr of CLOUDFLARE_V6) {
  const [net, bits] = cidr.split('/');
  cloudflare.addSubnet(net, Number(bits), 'ipv6');
}

/** Quita el prefijo de IPv4 mapeada en IPv6 (`::ffff:1.2.3.4`). */
function plain(ip: string): string {
  return ip.toLowerCase().startsWith('::ffff:') && isIP(ip.slice(7)) === 4 ? ip.slice(7) : ip;
}

export function isCloudflareIp(ip: string | undefined): boolean {
  if (!ip) return false;
  const addr = plain(ip);
  const family = isIP(addr);
  if (!family) return false;
  return cloudflare.check(addr, family === 4 ? 'ipv4' : 'ipv6');
}

/** IP a usar: la de `CF-Connecting-IP` si la conexión viene de Cloudflare y la cabecera es válida. */
export function resolveClientIp(peerIp: string | undefined, cfConnectingIp: string | string[] | undefined): string | undefined {
  if (!isCloudflareIp(peerIp)) return peerIp;
  const header = typeof cfConnectingIp === 'string' ? cfConnectingIp.trim() : '';
  return isIP(header) ? plain(header) : peerIp;
}

/** Sustituye `req.ip` por la IP real del cliente. Debe ir después de `trust proxy` y antes de los límites. */
export const cloudflareClientIp: RequestHandler = (req, _res, next) => {
  const ip = resolveClientIp(req.ip, req.headers['cf-connecting-ip']);
  if (ip && ip !== req.ip) {
    Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true, writable: true });
  }
  next();
};
