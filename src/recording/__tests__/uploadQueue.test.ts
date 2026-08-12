import { createUploadQueue } from "../uploadQueue";

test("processes items sequentially in FIFO order", async () => {
  const order: number[] = [];
  const upload = jest.fn(async (item: number) => {
    order.push(item);
  });
  const queue = createUploadQueue(upload);

  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  await queue.drain();

  expect(order).toEqual([1, 2, 3]);
  expect(queue.pendingCount()).toBe(0);
});

test("failed item stays queued and blocks later items until retry", async () => {
  let attempt = 0;
  const upload = jest.fn(async (item: number) => {
    if (item === 2 && attempt === 0) {
      attempt++;
      throw new Error("network down");
    }
  });
  const queue = createUploadQueue(upload);

  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  await queue.drain();

  // item 1 basarili, item 2 hata verdi ve kuyrukta kaldi, item 3'e gecilmedi
  expect(upload).toHaveBeenNthCalledWith(1, 1);
  expect(upload).toHaveBeenNthCalledWith(2, 2);
  expect(queue.pendingCount()).toBe(2); // 2 ve 3 hala bekliyor

  queue.retry();
  await queue.drain();

  expect(upload).toHaveBeenNthCalledWith(3, 2);
  expect(upload).toHaveBeenNthCalledWith(4, 3);
  expect(queue.pendingCount()).toBe(0);
});

test("pendingCount reflects items not yet uploaded", () => {
  const queue = createUploadQueue(async () => {});
  expect(queue.pendingCount()).toBe(0);
  queue.enqueue("a");
  queue.enqueue("b");
  expect(queue.pendingCount()).toBe(2);
});
