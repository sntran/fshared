const FSHARE_APP_KEY = Deno.env.get("FSHARE_APP_KEY") || "";
const API_URL = "https://api.fshare.vn/api";

/**
 * Chuẩn bị sẵn response yêu cầu login để sử dụng sau này.
 */
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
    /**
     * Trước khi xử lý yêu cầu, chúng ta kiểm tra xem trong headers đã lưu trữ
     * sẵn Basic Authentication hay chưa.
     */
    const authorization = headers.get("Authorization");
    /**
     * Nếu headers không có sẵn, gửi lại response yêu cầu đăng nhập Fshare.
     */
    if (!authorization) {
      return authResponse;
    }

    /**
     * Theo phương thức Basic Authentication, thông tin người dùng nhập vào sẽ
     * có dạng `username:password`, chuyển qua Base 64 và thêm "Basic: " ở đầu.
     * Do đó, chúng ta làm ngược lại để lấy username và password.
     */
    const [, base64 = ""] = authorization.match(/^Basic\s+(.*)$/) || [];
    const [user_email, password] = atob(base64).split(":");

    /**
     * Thử đăng nhập FShare với thông tin người dùng cung cấp.
     */
    const response = await fetch(`${API_URL}/user/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        app_key: FSHARE_APP_KEY,
        user_email,
        password,
      }),
      // Includes credentials with requests to same-origin URLs, and use
      // any credentials sent back in responses from same-origin URLs.
      credentials: "same-origin",
    });

    /**
     * Nếu đăng nhập không thành công, FShare trả về JSON gồm `code` và
     * `msg`. Ngược lại, FShare trả về `token` và `session_id`.
     */
    const { code, msg, token, session_id } = await response.json();

    if (!token) {
      return authResponse;
    }

    this.#token = token;

    /**
     * Đặt `session_id` vào cookie cho FShare.
     */
    headers.set("Cookie", `session_id=${session_id};`);

    return new Response(null, {
      status: code,
      statusText: msg,
    });
  }

  async download(url: string | URL, init: RequestInit = {}): Promise<Response> {
    const headers = this.#headers;
    const token = this.#token;
    if (!token) {
      const response = await this.login();
      if (!response.ok) {
        return response;
      }
    }

    url = new URL(url, "https://www.fshare.vn/file/");
    const password = url.searchParams.get("password");
    url.searchParams.delete("password");

    const {
      method = "POST",
      redirect = "follow",
    } = init;

    /**
     * Yêu cầu FShare tạo cho một session riêng để download.
     * API này yêu cầu gửi cho FShare địa chỉ đầy đủ cùa file, `token`
     * lấy được sau khi đăng nhập, và mật mã của file nếu có.
     */
    const response = await fetch(`${API_URL}/session/download`, {
      method,
      headers,
      body: JSON.stringify({
        url,
        token,
        password,
      }),
    });

    /**
     * Nếu thành công, FShare sẽ trả về JSON với `location` chứa link tải
     * trực tiếp từ FShare.
     */
    const { location } = await response.json();

    /**
     * Nếu thất bại, FShare sẽ trả về `{code: 201, msg: "Not logged in yet!"}`.
     * Điều này xảy ra vì nhiều lý do, nhưng đơn giản nhất là yêu cầu người
     * dùng đăng nhập lại.
     */
    if (!location) {
      return authResponse;
    }

    /**
     * Xử lý các trường hợp `redirect` khác giá trị mặc định "follow".
     */
    if (redirect === "manual") {
      return Response.redirect(location, 303);
    }
    if (redirect === "error") {
      throw new Error(`Redirected to ${location}`);
    }

    /**
     * Ở thời điểm này, `redirect` là "follow", nên chúng ta gọi tiếp
     * request tới `location` để trả về cho user.
     */
    return fetch(location, {
      method: "GET",
      headers,
    });
  }
}
