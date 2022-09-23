/**
 * Iterates over a ReadableStream, yielding chunks of data.
 *
 * ```ts
 * const response = await fetch("https://example.com");
 * for await (const chunk of iterateStream(response.body)) {
 *   console.log(chunk);
 * }
 * ```
 */
export async function* iterateStream(stream: ReadableStream, options?: {
  bufSize?: number;
}) {
  const reader = stream.getReader();
  const bufSize = options?.bufSize ?? 65_536;

  const emptyArray = new Uint8Array(0);
  let buffer = emptyArray;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      // Yield the last chunk.
      if (buffer.byteLength > 0) {
        yield buffer;
      }
      break;
    }

    // Constructs a new buffer to hold all the data so far.
    const chunk = new Uint8Array(buffer.byteLength + value.byteLength);
    chunk.set(buffer, 0);
    chunk.set(value, buffer.byteLength);

    if (chunk.byteLength >= bufSize) {
      yield chunk;
      // Reset the buffer.
      buffer = emptyArray;
    } else {
      buffer = chunk;
    }
  }
}

/**
 * Displays progress of a ReadableStream.
 */
export class Progress extends TransformStream {
  constructor(onProgress?: (progress: number) => void) {
    let completed = 0;

    super({
      transform: (
        chunk: Uint8Array,
        controller: TransformStreamDefaultController,
      ) => {
        completed += chunk.byteLength;
        onProgress?.(completed);
        controller.enqueue(chunk);
      },
    });
  }
}
