import { log_function_entry, log_function_error, log_function_success, root_logger } from '../logger';

const ngrok_logger = root_logger.child({ component: 'ngrok_tunnel' });

type NgrokModule = {
  readonly connect: (options: NgrokConnectOptions) => Promise<string>;
  readonly disconnect: (identifier: string) => Promise<void>;
  readonly kill: () => Promise<void>;
};

type NgrokConnectOptions = {
  readonly addr: number | string;
  readonly authtoken?: string;
  readonly hostname?: string;
  readonly region?: string;
  readonly proto?: string;
};

type NgrokModuleLoader = () => Promise<NgrokModule | undefined>;

export interface NgrokTunnelConfiguration {
  readonly http_port: number;
  readonly authtoken?: string;
  readonly domain?: string;
  readonly region?: string;
}

export interface NgrokTunnelHandle {
  readonly public_url: string;
  readonly disconnect: () => Promise<void>;
}

/**
 * Attempt to establish an ngrok tunnel for exposing the local webhook endpoint.
 * @param {NgrokTunnelConfiguration} configuration Configuration values controlling tunnel creation.
 * @param {NgrokModuleLoader} ngrok_module_loader Loader used to resolve the ngrok module. Primarily overridable for testing.
 * @returns {Promise<NgrokTunnelHandle | undefined>} Tunnel handle when successfully established; otherwise undefined when the module is unavailable.
 */
export async function establish_ngrok_tunnel(
  configuration: NgrokTunnelConfiguration,
  ngrok_module_loader: NgrokModuleLoader = load_ngrok_module
): Promise<NgrokTunnelHandle | undefined> {
  const function_name = 'establish_ngrok_tunnel';
  log_function_entry(ngrok_logger, function_name, {
    http_port: configuration.http_port,
    domain: configuration.domain,
    region: configuration.region
  });

  try {
    const ngrok_module = await ngrok_module_loader();
    if (!ngrok_module) {
      log_function_success(ngrok_logger, function_name, {
        http_port: configuration.http_port,
        module_available: false
      });
      return undefined;
    }

    const connect_options: NgrokConnectOptions = {
      addr: configuration.http_port,
      authtoken: configuration.authtoken,
      hostname: configuration.domain,
      region: configuration.region,
      proto: 'http'
    };

    const public_url = await ngrok_module.connect(connect_options);

    log_function_success(ngrok_logger, function_name, {
      http_port: configuration.http_port,
      module_available: true,
      public_url
    });

    return {
      public_url,
      disconnect: async (): Promise<void> => {
        await disconnect_ngrok_tunnel(ngrok_module, public_url);
      }
    };
  } catch (error) {
    log_function_error(ngrok_logger, function_name, error, {
      http_port: configuration.http_port
    });
    throw error;
  }
}

/**
 * Close an existing ngrok tunnel to release resources.
 * @param {NgrokModule} ngrok_module Resolved ngrok module instance.
 * @param {string} public_url Public URL of the established tunnel.
 * @returns {Promise<void>} Resolves when the tunnel is disconnected.
 */
async function disconnect_ngrok_tunnel(
  ngrok_module: NgrokModule,
  public_url: string
): Promise<void> {
  const function_name = 'disconnect_ngrok_tunnel';
  log_function_entry(ngrok_logger, function_name, { public_url });

  try {
    await ngrok_module.disconnect(public_url);
    await ngrok_module.kill();
    log_function_success(ngrok_logger, function_name, { public_url });
  } catch (error) {
    log_function_error(ngrok_logger, function_name, error, { public_url });
    throw error;
  }
}

async function load_ngrok_module(): Promise<NgrokModule | undefined> {
  const function_name = 'load_ngrok_module';
  log_function_entry(ngrok_logger, function_name);

  try {
    const dynamic_import = new Function('moduleId', 'return import(moduleId);') as (moduleId: string) => Promise<unknown>;
    const imported_module = (await dynamic_import('ngrok')) as { readonly default?: NgrokModule } & NgrokModule;
    const resolved_module = imported_module.default ?? imported_module;
    log_function_success(ngrok_logger, function_name, {
      module_available: Boolean(resolved_module)
    });
    return resolved_module;
  } catch (error) {
    log_function_error(ngrok_logger, function_name, error);
    return undefined;
  }
}
