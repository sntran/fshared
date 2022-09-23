# FShare Client

A simple client to interact with Fshare.VN through their API.

## Installation

Until static binaries are released, Deno must be installed. Instructions can be
found at https://deno.land/manual/getting_started/installation

Install this module as a standalone command named `fshare`, allowing all
permissions. Tweak the permission flags as needed. See
https://deno.land/manual/getting_started/permissions

```shell
deno install --unstable --allow-all -n fshare https://deno.land/x/fshare/main.ts
```

## Command-Line Usage

All commands requires `--username` and `--password` flags to authenticate with
FShare. Environment variables `FSHARE_USER_EMAIL` and `FSHARE_PASSWORD` can also
be used to avoid the credentials being in the shell's history.

### Download

Download command renders a progress bar by default, and can be turned off with
`--no-progress` flag.

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

Upload command renders a progress bar by default, and can be turned off with
`--no-progress` flag.

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

### Other Operations

Get user's file/folder list

```shell
fshare list --pageIndex=0 dirOnly=0 --limit=100 --path="" --ext=""
```

Creates a folder under a parent folder. The parent can be `0` for root, or
`linkcode` of another folder.

```shell
fshare createFolder name parentLinkcode
```

Renames a file or folder using its `linkcode`.

```shell
fshare rename linkcode, newName
```

Moves file(s) or folder(s) using their `linkcode` to a new root.

```shell
fshare move linkcode, parentLinkcode
```

Deletes file(s) or folder(s) using their `linkcode`.

```shell
fshare delete linkcode
```

Sets password for file(s) using their `linkcode`.

```shell
fshare createFilePass linkcode password
```

Toggles files(s) secure storage using their `linkcode`. Setting `status` 1 to
put the items in secure storage, 0 to remove them.

```shell
fshare changeSecure linkcode 1
```

Duplicates file using its `linkcode` to a `linkcode` of another folder.

```shell
fshare duplicate linkcode, parentLinkCode
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

## API Reference

```ts
login(): Promise<Response>;
logout(): Promise<Response>;
user(): Promise<Response>;
upload(url: string | URL, init?: RequestInit): Promise<Response>;
download(url: string | URL, init?: RequestInit): Promise<Response>;
list(params: Partial<ListParams>): Promise<Response>;
createFolder(name: string, parent: linkcode): Promise<Response>;
rename(item: linkcode, to: string): Promise<Response>;
move(item: linkcode, to: linkcode): Promise<Response>;
move(items: linkcode[], to: linkcode): Promise<Response>;
move(items: linkcode | linkcode[], to: linkcode): Promise<Response>;
delete(item: linkcode): Promise<Response>;
delete(items: linkcode[]): Promise<Response>;
delete(items: linkcode | linkcode[]): Promise<Response>;
createFilePass(item: linkcode, password: string): Promise<Response>;
createFilePass(items: linkcode[], password: string): Promise<Response>;
createFilePass(
  items: linkcode | linkcode[],
  password: string,
): Promise<Response>;
changeSecure(item: linkcode, status: toggle): Promise<Response>;
changeSecure(items: linkcode[], status: toggle): Promise<Response>;
changeSecure(items: linkcode | linkcode[], status: toggle): Promise<Response>;
duplicate(item: linkcode, to: linkcode): Promise<Response>;
```

## Examples

More examples can be found in [examples](./examples) folder.

## Roadmap

- [ ] Upload multiple files
- [ ] Download multiple linkcodes
- [ ] Download multiple files from a folder
