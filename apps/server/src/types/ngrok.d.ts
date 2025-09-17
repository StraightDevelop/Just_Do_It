declare module 'ngrok' {
  export interface NgrokConnectOptions {
    readonly addr: string | number;
    readonly authtoken?: string;
    readonly hostname?: string;
    readonly region?: string;
    readonly proto?: string;
  }

  export function connect(options: NgrokConnectOptions): Promise<string>;
  export function disconnect(identifier: string): Promise<void>;
  export function kill(): Promise<void>;
  const ngrok: {
    connect: typeof connect;
    disconnect: typeof disconnect;
    kill: typeof kill;
  };
  export default ngrok;
}
