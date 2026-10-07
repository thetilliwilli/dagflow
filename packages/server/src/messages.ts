// Тексты сервера (contracts/ui-texts.md, раздел «Сервер»; FR-030, FR-030a)

export const serverMessages = {
  listening: (version: string, host: string, port: number) =>
    `DAG Flow engine ${version} is listening on ${host}:${port}`,
  protocol: (version: number) => `Protocol version: ${version}. Press Ctrl+C to stop.`,
  noAuthentication:
    'The engine has no authentication. Anyone who can reach this address can run workflows on it.',
  portInUse: (port: number) =>
    `Port ${port} is already in use. Start the server with another port: --port <number>.`,
  invalidPort: (value: string) => `Invalid port “${value}”. Use a number from 1 to 65535.`,
  unknownOption: (name: string) =>
    `Unknown option “${name}”. Options: --port <number>, --host <address>, --verbose.`,
  cannotListen: (host: string) => `Cannot listen on ${host}. Check the --host address.`,
  connected: (client: string, count: number) => `Connected: ${client} (connections: ${count})`,
  disconnected: (client: string, count: number) =>
    `Disconnected: ${client} (connections: ${count})`,
  errorFrom: (client: string, code: string) => `Error from ${client}: ${code}`,
  message: (
    client: string,
    dir: 'in' | 'out',
    type: string,
    doc: string | undefined,
    bytes: number,
  ) => `${client} ${dir} ${type} ${doc ?? '-'} ${bytes} B`,
  httpBody: (version: string) => `DAG Flow engine ${version}`,
};
