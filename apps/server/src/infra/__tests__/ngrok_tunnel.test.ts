import { establish_ngrok_tunnel, type NgrokTunnelConfiguration } from '../ngrok_tunnel';

describe('establish_ngrok_tunnel', () => {
  const configuration: NgrokTunnelConfiguration = {
    http_port: 8080,
    authtoken: 'token-123',
    domain: 'example.ngrok.dev',
    region: 'us'
  };

  test('returns handle when ngrok module is available', async () => {
    const connect = jest.fn(async () => 'https://example.ngrok.dev');
    const disconnect = jest.fn(async () => undefined);
    const kill = jest.fn(async () => undefined);

    const handle = await establish_ngrok_tunnel(configuration, async () => ({
      connect,
      disconnect,
      kill
    }));

    expect(connect).toHaveBeenCalledWith({
      addr: configuration.http_port,
      authtoken: configuration.authtoken,
      hostname: configuration.domain,
      region: configuration.region,
      proto: 'http'
    });
    expect(handle).toBeDefined();
    expect(handle?.public_url).toBe('https://example.ngrok.dev');

    await handle?.disconnect();

    expect(disconnect).toHaveBeenCalledWith('https://example.ngrok.dev');
    expect(kill).toHaveBeenCalledTimes(1);
  });

  test('returns undefined when ngrok module is unavailable', async () => {
    const handle = await establish_ngrok_tunnel(configuration, async () => undefined);

    expect(handle).toBeUndefined();
  });
});
