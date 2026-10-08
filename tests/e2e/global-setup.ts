// Перед e2e собрать сервер выполнения: тесты запускают собранный бандл (research R13, R17)
import { execSync } from 'node:child_process';

export default function globalSetup() {
  execSync('npm run build:server', { stdio: 'ignore' });
}
