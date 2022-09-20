const FSHARE_APP_KEY = Deno.env.get("FSHARE_APP_KEY") || "";
const API_URL = "https://api.fshare.vn/api";

const authResponse = new Response("401 Unauthorized", {
  status: 401,
  statusText: "Unauthorized",
  headers: {
    "WWW-Authenticate": `Basic realm="Login", charset="UTF-8"`,
  },
});

export interface FShareClient {
  login(): Promise<Response>;
  download(url: string | URL, init?: RequestInit): Promise<Response>;
}

export class Client implements FShareClient {
  #headers: Headers;
  #token: string;

  constructor(init: RequestInit) {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json; charset=utf-8");
    this.#headers = headers;
    this.#token = "";
  }

  async login(): Promise<Response> {
    const headers = this.#headers;
    const authorization = headers.get("Authorization");

    if (!authorization) {
      return authResponse;
    }

    const [, base64 = ""] = authorization.match(/^Basic\s+(.*)$/) || [];
    const [user_email, password] = atob(base64).split(":");

    const response = await fetch(`${API_URL}/user/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        app_key: FSHARE_APP_KEY,
        user_email,
        password,
      }),
      credentials: "same-origin",
    });

    const { code, msg, token, session_id } = await response.json();

    if (!token) {
      return authResponse;
    }

    this.#token = token;
    headers.set("Cookie", `session_id=${session_id};`);

    return new Response(null, {
      status: code,
      statusText: msg,
    });
  }

  async download(url: string | URL, init: RequestInit = {}): Promise<Response> {
    const headers = this.#headers;
    let token = this.#token;

    if (!token) {
      const response = await this.login();
      if (!response.ok) {
        return response;
      }
      token = this.#token;
    }

    url = new URL(url, "https://www.fshare.vn/file/");
    const password = url.searchParams.get("password");
    url.searchParams.delete("password");

    const {
      method = "POST",
      redirect = "follow",
    } = init;

    const response = await fetch(`${API_URL}/session/download`, {
      method,
      headers,
      body: JSON.stringify({
        url,
        token,
        password,
      }),
    });

    const { location } = await response.json();

    if (!location) {
      return authResponse;
    }

    if (redirect === "manual") {
      return Response.redirect(location, 303);
    }
    if (redirect === "error") {
      throw new Error(`Redirected to ${location}`);
    }

    return fetch(location, {
      method: "GET",
      headers,
    });
  }
}
