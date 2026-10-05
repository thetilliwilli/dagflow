// In-memory FileSystemDirectoryHandle для тестов хранилища
type Entry = FakeDirectory | FakeFile;

export class FakeFile {
  readonly kind = 'file';
  writes = 0;
  constructor(
    public name: string,
    public content = '',
  ) {}
  async getFile() {
    const content = this.content;
    return { text: async () => content };
  }
  async createWritable() {
    let buffer = '';
    return {
      write: async (data: string) => {
        buffer += data;
      },
      close: async () => {
        this.content = buffer;
        this.writes += 1;
      },
    };
  }
}

export class FakeDirectory {
  readonly kind = 'directory';
  entries = new Map<string, Entry>();
  permission: PermissionState = 'granted';
  /** Счётчик обращений к содержимому — для проверки «ни одного чтения до восстановления доступа». */
  accessCount = 0;
  /** Если задано — любые операции падают с этой ошибкой (папка стала недоступна). */
  failWith: Error | null = null;

  constructor(public name = 'root') {}

  private touch() {
    this.accessCount += 1;
    if (this.failWith) throw this.failWith;
  }

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDirectory> {
    this.touch();
    let e = this.entries.get(name);
    if (!e) {
      if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError');
      e = new FakeDirectory(name);
      this.entries.set(name, e);
    }
    if (!(e instanceof FakeDirectory)) throw new DOMException('not a directory', 'TypeMismatchError');
    return e;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<FakeFile> {
    this.touch();
    let e = this.entries.get(name);
    if (!e) {
      if (!opts?.create) throw new DOMException(`${name} not found`, 'NotFoundError');
      e = new FakeFile(name);
      this.entries.set(name, e);
    }
    if (!(e instanceof FakeFile)) throw new DOMException('not a file', 'TypeMismatchError');
    return e;
  }

  async removeEntry(name: string) {
    this.touch();
    if (!this.entries.delete(name)) throw new DOMException(`${name} not found`, 'NotFoundError');
  }

  async *values(): AsyncGenerator<Entry> {
    this.touch();
    yield* this.entries.values();
  }

  async queryPermission(): Promise<PermissionState> {
    return this.permission;
  }

  async requestPermission(): Promise<PermissionState> {
    return this.permission;
  }

  // --- помощники для тестов ---
  /** Подпапка по пути (без обращений к счётчикам). */
  private dirAt(parts: string[], create: boolean): FakeDirectory | undefined {
    if (parts.length === 0) return this;
    const [head, ...rest] = parts;
    let e = this.entries.get(head!);
    if (!e && create) {
      e = new FakeDirectory(head);
      this.entries.set(head!, e);
    }
    return e instanceof FakeDirectory ? e.dirAt(rest, create) : undefined;
  }

  file(path: string): FakeFile | undefined {
    const parts = path.split('/');
    const f = this.dirAt(parts.slice(0, -1), false)?.entries.get(parts.at(-1)!);
    return f instanceof FakeFile ? f : undefined;
  }

  put(path: string, content: string) {
    const parts = path.split('/');
    const name = parts.at(-1)!;
    this.dirAt(parts.slice(0, -1), true)!.entries.set(name, new FakeFile(name, content));
  }

  paths(prefix = ''): string[] {
    const result: string[] = [];
    for (const [name, e] of this.entries) {
      if (e instanceof FakeDirectory) result.push(...e.paths(`${prefix}${name}/`));
      else result.push(`${prefix}${name}`);
    }
    return result.sort();
  }

  /** Приведение к типу DOM для передачи в код приложения. */
  asHandle(): FileSystemDirectoryHandle {
    return this as unknown as FileSystemDirectoryHandle;
  }
}
