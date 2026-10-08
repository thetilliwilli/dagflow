// Цель «Local»: хост протокола в том же потоке (research R4)
import { createEngineHost, type Channel, type HostMessage } from '@dagflow/protocol';

type Schedule = (fn: () => void) => void;

/**
 * Канал к хосту в этом же окне. Сообщения — строки, как в сети: общих ссылок со стором нет.
 * Доставка синхронная, пересчёт (`tick`) — через `schedule` (по умолчанию раз в кадр), поэтому
 * несколько правок до кадра объединяются в один пересчёт (FR-016).
 */
export function createInlineChannel(schedule: Schedule): Channel {
  // В окне лимита размера нет: он у сервера (FR-024, FR-002)
  const host = createEngineHost({ maxMessageBytes: Infinity });
  let scheduled = false;
  let closed = false;

  const channel: Channel = {
    onMessage: () => {},
    onClose: () => {},
    send(text) {
      if (closed) return;
      let replies: HostMessage[];
      try {
        replies = host.receive(text);
      } catch (e) {
        replies = [{ type: 'error', code: 'internal', detail: String(e) }];
      }
      deliver(replies);
      if (host.closed) channel.close();
      else planTick();
    },
    close() {
      if (closed) return;
      closed = true;
      channel.onClose('closed');
    },
  };

  function deliver(replies: HostMessage[]) {
    for (const reply of replies) if (!closed) channel.onMessage(JSON.stringify(reply));
  }

  function planTick() {
    if (scheduled || !host.needsTick()) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      if (closed) return;
      let replies: HostMessage[];
      try {
        replies = host.tick();
      } catch (e) {
        replies = [{ type: 'error', code: 'internal', detail: String(e) }];
      }
      deliver(replies);
    });
  }

  return channel;
}
