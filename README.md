# FShare Client

A simple client to interact with Fshare.VN through their API.

## Installation

Until static binaries are released, Deno must be installed.
Instructions can be found at
https://deno.land/manual/getting_started/installation

Install this module as a standalone command named `fshare`, allowing all permissions.
Tweak the permission flags as needed.
See https://deno.land/manual/getting_started/permissions

```shell
deno install --unstable --allow-all -n fshare https://deno.land/x/fshare/main.ts
```

## Command-Line Usage

### Download

Downloads a file to the current directory, using the file name on Fshare.

```shell
fshare download -LO https://www.fshare.vn/file/XXXXXXXXXX
```

Downloads a file using its ID to the current directory.

```shell
fshare download -LO XXXXXXXXXX
```

Downloads a file to the current directory, with custom file name:

```shell
fshare download -L XXXXXXXXXX --output my.file
```

Downloads a file and redirects it to a file:

```shell
fshare download -L XXXXXXXXXX > my.file
```

Downloads a file and streams it to `rclone`

```shell
fshare download -L XXXXXXXXXX | rclone rcat remote:path/to/file
```

### Upload

Uploads a file with relative path to a folder in FShare:

```shell
fshare upload -L ./local.file /remote-folder
```

Uploads a file with absolute path to a folder in FShare:

```shell
fshare upload -L /home/user/Downloads/local.file /remote-folder
```

Uploads a file from `stdin`, passing the `size` flag:

```shell
cat ./local.file | fshare upload -L - /remote-folder
# OR from `rclone cat`
rclone cat remote:path/to/file | fshare upload -L - /remote-folder
```

## Deno Usage

```ts
import { Client } from "https://deno.land/x/fshare/mod.ts";

const client = await Client.connect("user@example.com", "passwod");

// Uploads a file to FShare from `stdin`.
let response = await client.upload("/folder/file.txt", {
  headers: {
    "Content-Length": "123",
  },
  body: Deno.stdin.readable,
});
// Retrieves the uploaded file's URL in the response.
const { url } = await response.json();

// Downloads from the file URL.
response = await client.download(url);
// Sends file content to `stdout`.
await response.body!.pipeTo(Deno.stdout.writable);
```

## Examples

More examples can be found in [examples](examples) folder.
