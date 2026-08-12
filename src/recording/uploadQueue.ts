export function createUploadQueue<T>(upload: (item: T) => Promise<void>) {
  const items: T[] = [];
  let ongoingDrain: Promise<void> | null = null;

  async function drain(): Promise<void> {
    if (ongoingDrain) {
      return ongoingDrain;
    }

    ongoingDrain = (async () => {
      try {
        while (items.length > 0) {
          const item = items[0];
          try {
            await upload(item);
            items.shift();
          } catch {
            // Basarisiz oge kuyrukta kalir, sonraki ogelere gecilmez
            break;
          }
        }
      } finally {
        ongoingDrain = null;
      }
    })();

    return ongoingDrain;
  }

  return {
    enqueue(item: T) {
      items.push(item);
      void drain();
    },
    drain,
    retry() {
      void drain();
    },
    pendingCount() {
      return items.length;
    },
  };
}
