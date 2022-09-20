import { router } from "https://crux.land/router@0.0.12";
import { Client } from "../client.ts";

export function file(
  request: Request,
  _context,
  { id },
): Promise<Response> {
  const client = new Client({
    headers: request.headers,
  });

  const { searchParams } = new URL(request.url);
  if (!id) {
    id = searchParams.get("id");
  }

  return client.download(id);
}

function home(request: Request): Response {
  const { origin } = new URL(request.url);

  const body = `
  <!DOCTYPE html>
  <html lang="en" class="motion-safe:scroll-smooth text-[18px] antialiased">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fshare</title>

    <script src="https://cdn.tailwindcss.com?plugins=forms,typography,aspect-ratio,line-clamp"></script>
  </head>

  <body class="container mx-auto">
    <main class="prose">
      <form action="/file" method="GET">
        <label>
          ${origin}/file/<input type="text" name="id" placeholder="file-id" class="p-0 border-0 border-b" />
        </label>
        <button type="submit">Go</button>
      </form>
    </main>
  </body>
  </html>
  `;

  return new Response(body, {
    headers: {
      "content-type": "text/html;charset=utf-8",
    },
  });
}

//#region Server
/**
 * Khởi động server và thiết lập router tương đương.
 */
await Deno.serve(router(
  {
    "GET@/": home,
    "GET@/file": file,
    "GET@/file/:id": file,
  },
));
//#endregion
