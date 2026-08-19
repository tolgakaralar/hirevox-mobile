import { login, submitAnswer, uploadVideoChunk, ApiError } from "../client";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetAllMocks();
});

test("login POSTs code and returns sessionId", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ sessionId: "abc-123", message: "Giriş başarılı" }),
  }) as unknown as typeof fetch;

  const result = await login("12345678");

  expect(global.fetch).toHaveBeenCalledWith(
    "https://test.local/api/login",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ code: "12345678" }),
    })
  );
  expect(result).toEqual({ sessionId: "abc-123", message: "Giriş başarılı" });
});

test("login throws ApiError with backend message on non-ok response", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ error: "Geçersiz erişim kodu" }),
  }) as unknown as typeof fetch;

  await expect(login("wrong")).rejects.toMatchObject({
    message: "Geçersiz erişim kodu",
    status: 401,
  });
});

test("submitAnswer omits type field entirely (mobile never sends code type)", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ saved: true }),
  }) as unknown as typeof fetch;

  await submitAnswer({
    sessionId: "s1",
    phase: "main",
    topic: "JavaScript",
    askedText: "Soru metni",
    transcript: "Cevap",
    difficulty: 2,
  });

  const call = (global.fetch as jest.Mock).mock.calls[0];
  const body = JSON.parse(call[1].body);
  expect(body.type).toBeUndefined();
});

test("uploadVideoChunk sends multipart form with segmentIndex", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ saved: true }),
  }) as unknown as typeof fetch;

  await uploadVideoChunk("s1", 2, "file:///tmp/clip.mp4", "video/mp4");

  const call = (global.fetch as jest.Mock).mock.calls[0];
  expect(call[0]).toBe("https://test.local/api/interview/video-chunk");
  const form = call[1].body as FormData;
  expect(form).toBeInstanceOf(FormData);
});

test("ApiError carries status code", () => {
  const err = new ApiError("boom", 500);
  expect(err.status).toBe(500);
  expect(err.message).toBe("boom");
  expect(err).toBeInstanceOf(Error);
});
