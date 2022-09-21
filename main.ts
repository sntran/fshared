#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

import { basename, join, parseFlags, ProgressBar } from "./deps.ts";

import { Client } from "./client.ts";

/**
 * Displays progress of a ReadableStream.
 */
class Progress extends TransformStream {
  constructor(total?: number) {
    let progressBar: ProgressBar, completed = 0;
    if (total) {
      progressBar = new ProgressBar({
        total,
      });
    }

    super({
      transform: (chunk: Uint8Array, controller: TransformStreamDefaultController) => {
        completed += chunk.byteLength;
        progressBar?.render(completed);
        controller.enqueue(chunk);
      },
    });
  }
}

const flags = parseFlags(Deno.args, {
  boolean: [
    /** Whether to follows redirect */
    "location",
    /** Whether to use remote name as output. */
    "remote-name",
    /** Whether to show progress bar. */
    "progress",
  ],
  negatable: [
    "progress",
  ],
  string: [
    "_",
    "username",
    "password",
    /** Any custom header */
    "header",
    /** Input body */
    "body",
    /** Output filename */
    "output",
    /** The exact size of the input stream if known in advance. */
    "size",
  ],
  collect: [
    "header",
  ],
  alias: {
    "username": ["user", "u"],
    "password": ["pass", "p"],
    "header": "H",
    "body": "B",
    "location": "L",
    "output": "o",
    "remote-name": ["O", "remoteName"],
  },
  default: {
    user: Deno.env.get("FSHARE_USER_EMAIL"),
    pass: Deno.env.get("FSHARE_PASSWORD"),
    progress: true,
  },
});

const {
  username,
  password,
  header,
  location,
  remoteName,
  progress,
  _: [command, ...args],
} = flags;

let {
  output,
  size,
} = flags;

const headers = [].concat(header).reduce((headers, header: string) => {
  const [key, value] = header.split(/:\s?/);
  headers.append(key, value);
  return headers;
}, new Headers());

if (username && password) {
  headers.set("Authorization", `Basic ${btoa(`${username}:${password}`)}`);
}

const client = new Client({
  headers,
});
// Login
const response = await client.login();
if (!response.ok) {
  console.error("Login failed");
  Deno.exit(1);
}

let writable: WritableStream = Deno.stdout.writable;

if (output) {
  writable = (await Deno.open(output, {
    read: false,
    create: true,
    write: true,
  })).writable;
}

const redirect = location ? "follow" : "manual";

if (command === "download") {
  const { url, body, headers } = await client.download(args[0], {
    redirect,
  });

  if (remoteName) {
    output = new URL(url).pathname.split("/").pop();
    writable = (await Deno.open(output, {
      read: false,
      create: true,
      write: true,
    })).writable;
  }

  if (body) {
    const size = Number(headers.get("Content-Length"));
    body
      .pipeThrough(new Progress(progress? size : undefined))
      .pipeTo(writable);
  }
}

if (command === "upload") {
  const input = args[0], path = args[1] || "/";
  if (!input) {
    console.error("Missing input file");
    Deno.exit(1);
  }

  let body: BodyInit;
  const headers: HeadersInit = {};

  if (input === "-") {
    body = Deno.stdin.readable;
    if (!size) {
      console.error("Must provide size for input from stdin");
      Deno.exit(1);
    }
  } else {
    const file = await Deno.open(input, {
      read: true,
      write: false,
    });
    body = file.readable;
    if (!size) {
      size = `${(await file.stat()).size}`;
    }
  }

  headers["Content-Length"] = size;

  const response = await client.upload(join(path, basename(input)), {
    redirect,
    headers,
    body: body.pipeThrough(new Progress(progress? size : undefined)),
  });

  if (!response.ok) {
    console.error("Upload failed");
    Deno.exit(1);
  }

  const { url } = await response.json();
  console.log(url);
}
