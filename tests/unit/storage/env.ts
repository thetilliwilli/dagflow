import type { LocationEnv } from '../../../src/storage/location';
import { FakeDirectory } from './fake-directory';

/** Окружение браузера для тестов: OPFS и выбранная папка — фейки в памяти. */
export function fakeEnv(
  opts: { picker?: boolean; folder?: FakeDirectory; saved?: FakeDirectory } = {},
) {
  const opfs = new FakeDirectory('opfs');
  const folder = opts.folder ?? new FakeDirectory('my-flows');
  let saved: FileSystemDirectoryHandle | undefined = opts.saved?.asHandle();
  let pickerResult: 'ok' | 'cancel' = 'ok';
  const env: LocationEnv = {
    showDirectoryPicker:
      opts.picker === false
        ? undefined
        : async () => {
            if (pickerResult === 'cancel') throw new DOMException('cancelled', 'AbortError');
            return folder.asHandle();
          },
    getOpfsRoot: async () => opfs.asHandle(),
    loadHandle: async () => saved,
    saveHandle: async (h) => {
      saved = h;
    },
  };
  return {
    env,
    opfs,
    folder,
    savedHandle: () => saved,
    cancelPicker: () => {
      pickerResult = 'cancel';
    },
  };
}
