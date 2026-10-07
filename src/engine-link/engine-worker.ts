// Фоновый поток с хостом протокола (цель «Worker», research R14): строки postMessage в обе стороны
import { createEngineHost, type HostMessage } from '@dagflow/protocol';

const scope = self as unknown as {
  onmessage: ((e: { data: unknown }) => void) | null;
  postMessage(text: string): void;
  close(): void;
};

const host = createEngineHost();
let scheduled = false;

function post(replies: HostMessage[]) {
  for (const reply of replies) scope.postMessage(JSON.stringify(reply));
}

function planTick() {
  if (scheduled || !host.needsTick()) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    post(host.tick());
  }, 0);
}

scope.onmessage = (e) => {
  // Исключения хоста он сам превращает в error internal; падение потока видит редактор (FR-027)
  post(host.receive(String(e.data)));
  if (host.closed) scope.close();
  else planTick();
};
