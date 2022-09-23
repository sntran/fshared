#!/usr/bin/env -S deno run --unstable --allow-all

import { config } from "https://deno.land/std@0.157.0/dotenv/mod.ts";
import { prettyBytes } from "https://deno.land/std@0.157.0/fmt/bytes.ts";
import { router } from "https://crux.land/router@0.0.12";
// TweetNaCl is a cryptography library that we use to verify requests
// from Discord.
import { sign } from "https://cdn.skypack.dev/tweetnacl@v1.0.3?dts";

import { Client, iterateStream } from "../mod.ts";

const DISCORD_BASE_URL = "https://discord.com/api/v10";

const {
  FSHARE_USER_EMAIL,
  FSHARE_PASSWORD,
  DISCORD_APPLICATION_ID,
  DISCORD_PUBLIC_KEY,
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  PORT = 8080,
} = await config({ safe: true });

const [command = "start", ...args] = Deno.args;

if (command === "register") {
  const [guildId] = args;
  const response = await registerApplicationCommands(guildId);
  console.log(await response.json());
  Deno.exit(0);
}

const client = new Client({
  headers: {
    "Authorization": `Basic ${btoa(`${FSHARE_USER_EMAIL}:${FSHARE_PASSWORD}`)}`,
  },
});
const response = await client.login();
if (!response.ok) {
  console.error("Login failed");
  Deno.exit(1);
}

// For all requests to "/" endpoint, we want to invoke home() handler.
await Deno.serve(
  {
    port: PORT,
  },
  router({
    "/": home,
  }),
);

// The main logic of the Discord Slash Command is defined in this function.
async function home(request: Request): Promise<Response> {
  // validateRequest() ensures that a request is of POST method with required headers.
  const { error, status, body } = await validateRequest(request);
  if (error) {
    return Response.json({ error }, { status });
  }

  const {
    // id,
    type = 0,
    data: {
      // id,
      name = "fshare",
      options: [{
        name: command,
        options = [],
      }],
    },
    // guild_id,
    // channel_id,
    // member = { user: null },
    // user,
    token,
    // version,
    // message,
    // locale,
    // guild_locale,
  } = JSON.parse(body!);

  // Discord performs Ping interactions to test our application.
  // Type 1 in a request implies a Ping interaction.
  if (type === 1) {
    return Response.json({
      type: 1, // Type 1 in a response is a Pong interaction response type.
    });
  }

  // Type 2 in a request is an ApplicationCommand interaction.
  if (type === 2 && command === "download") {
    // @ts-ignore option should have value
    const [input, password] = options.map((option) => option.value!);
    const startTime = Date.now();
    let elapsed = 0, rate = "0MB/s";

    // Starts the download process in the background.
    client.download(`${input}?password=${password}`)
      .then(async ({ url, body, headers }) => {
        if (!body) {
          return;
        }

        const bufSize = 65536 * 1024 / 8; // 8MB
        const output = new URL(url).pathname.split("/").pop();
        const size = Number(headers.get("Content-Length"));

        const header = `**File**: ${output} (${prettyBytes(size)})`;

        editReply(token, {
          content: `${header}\n**Status**: Starting`,
        });

        let start = 0;
        for await (const chunk of iterateStream(body, { bufSize })) {
          // Elapsed time in seconds
          elapsed = (Date.now() - startTime) / 1000;
          const end = start + chunk.byteLength;
          start = end;

          rate = prettyBytes(end / elapsed);
          const eta = end == 0
            ? "-"
            : (end >= size ? "0s" : prettySeconds((size / end - 1) * elapsed));

          /**
           * Discord only allows 15 minutes to respond to an interaction.
           * After that, the interaction is considered expired, so we don't
           * want to update the reply with progress any further.
           */
          if ((elapsed / 60) < 15) {
            await editReply(token, {
              content: `${header}\n**Status**: ${
                prettyBytes(end)
              } @ ${rate}/s. ETA: ${eta}`,
            });
          }

          const file = await Deno.open(output!, {
            read: false,
            create: true,
            write: true,
          });

          await file.write(chunk);
        }

        console.log(`Finished downloading ${output} in ${elapsed} seconds`);
        if ((elapsed / 60) < 15) {
          editReply(token, {
            content: `${header}\n**Status**: Downloaded @ ${rate}/s in ${
              prettySeconds(elapsed)
            }`,
          });
        }
      });

    // Responds immediately with an ACK so the user sees a loading state.
    // The promise above will edit the response with the actual result.
    return Response.json({
      type: 5,
    });
  }

  return Response.json({ error: "bad request" }, { status: 400 });
}

function editReply(token: string, data: Record<string, unknown>) {
  return fetch(
    `${DISCORD_BASE_URL}/webhooks/${DISCORD_APPLICATION_ID}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );
}

/**
 * Verify whether the request is coming from Discord.
 * When the request's signature is not valid, we return a 401 and this is
 * important as Discord sends invalid requests to test our verification.
 */
async function validateRequest(
  request: Request,
): Promise<{ error?: string; status?: number; body?: string }> {
  const signature = request.headers.get("X-Signature-Ed25519")!;
  const timestamp = request.headers.get("X-Signature-Timestamp")!;
  if (!signature) {
    return { error: `header X-Signature-Ed25519 not available`, status: 400 };
  }
  if (!timestamp) {
    return {
      error: `header X-Signature-Timestamp not available`,
      status: 400,
    };
  }

  const body = await request.text();

  const valid = sign.detached.verify(
    new TextEncoder().encode(timestamp + body),
    hexToUint8Array(signature),
    hexToUint8Array(DISCORD_PUBLIC_KEY),
  );

  if (!valid) {
    return { error: "Invalid request", status: 401 };
  }

  return { body };
}

/** Converts a hexadecimal string to Uint8Array. */
function hexToUint8Array(hex: string) {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((val) => parseInt(val, 16)));
}

function registerApplicationCommands(
  guildId = DISCORD_GUILD_ID,
): Promise<Response> {
  const commands = [
    {
      type: 1, // Slash Command
      name: "fshare",
      description: "Interact with Fshare.VN",
      description_localizations: {
        "vi": "Thao tác với Fshare.VN",
      },
      options: [
        {
          type: 1, // SUB_COMMAND
          name: "download",
          description: "Download a file from Fshare",
          description_localizations: {
            "vi": "Tải một tệp từ Fshare",
          },
          options: [
            {
              name: "url",
              description: "The full URL or linkcode of the file",
              description_localizations: {
                "vi": "URL hoặc linkcode đầy đủ của tệp",
              },
              type: 3, // STRING
              required: true,
            },
            {
              name: "password",
              description: "Optional password for the file",
              description_localizations: {
                "vi": "Mật khẩu cho tệp nếu có",
              },
              type: 3, // STRING
            },
          ],
        },
      ],
    },
  ];

  const endpoint = guildId
    ? `applications/${DISCORD_APPLICATION_ID}/guilds/${guildId}/commands`
    : `applications/${DISCORD_APPLICATION_ID}/commands`;
  const headers = {
    "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };

  return fetch(`${DISCORD_BASE_URL}/${endpoint}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(commands),
  });
}

/**
 * Pretifies number of seconds into "dd:hh:mm:ss".
 */
export function prettySeconds(seconds: number): string {
  let result = new Date(1000 * seconds).toISOString().substring(11, 19);
  // Prefixes with number of days if any.
  result = parseInt(`${seconds / 86400}`) + `:${result}`;
  // result = result.replace(/00/g, "0");
  result = result.replace(
    /(\d+:)?(\d+:)?(\d+:)?(\d+)?/,
    (_, days, hours, minutes, seconds) => {
      let result = seconds + "s";
      if (minutes) result = minutes.replace(":", "m:") + result;
      if (hours) result = hours.replace(":", "h:") + result;
      if (days) result = days.replace(":", "d:") + result;
      return result;
    },
  );
  result = result.replace(/^[0(d|h|m|s):]+/, "");
  result = result.replace(/00/g, "0");

  return result;
}
