/**
 * Với một số thứ nhạy cảm như app key, hoặc những thứ cần tuỳ biến,
 * chúng ta lưu vào biến môi trường (environment variables), và dùng
 * `Deno.env.toObject()` để truy cập ra lúc chạy.
 */
const {
  FSHARE_APP_KEY = "",
  FSHARE_USER_AGENT = "",
} = Deno.env.toObject();

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

/** 
 * Chúng ta sẽ tạo một handler để xử lý yêu cầu tải file. Hanlder này sẽ
 * được gọi khi người dùng truy cập vào một route có `:id` param,
 * và sẽ stream file được yêu cầu về lại cho user.
 * 
 * Để tiện dùng, chúng ta cũng hỗ trợ route với searchParam `?id={id}`.
 */
export async function file(request: Request, context, { id }): Promise<Response> {
  /**
   * Trước khi xử lý yêu cầu, chúng ta kiểm tra xem trong headers đã lưu trữ
   * sẵn Basic Authentication hay chưa.
   */
  const authorization = request.headers.get("Authorization");
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
  let [user_email, password] = atob(base64).split(":");

  /**
   * Thiết lập headers cơ bản cho các yêu cầu tới FShare.
   */
  const headers = new Headers({
    "User-Agent": request.headers.get("User-Agent") || FSHARE_USER_AGENT,
    "Content-Type": "application/json; charset=utf-8",
  });

  /**
   * Thử đăng nhập FShare với thông tin người dùng cung cấp.
   */
  let response = await fetch(`${API_URL}/user/login`, {
    headers,
    method: "POST",
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

  /**
   * Đặt `session_id` vào cookie cho FShare.
   */
  headers.append("Cookie", `session_id=${session_id};`);

  /**
   * Chuyển đổi `url` của request thành một `URL` để lấy `searchParams`
   * cho những tuỳ chọn khác như mật mã của file.
   */
  const { searchParams } = new URL(request.url);

  /**
   * File trên FShare có thể mã khoá, và chúng ta có thể nhận mã từ
   * `searchParams`. Ví dụ `/file/abc?password=def`
   */
  password = searchParams.get("password") || "";

  /**
   * Hỗ trợ luôn yêu cầu từ `/file?id={id}`
   */
  if (!id) {
    id = searchParams.get("id");
  }

  /**
   * Yêu cầu FShare tạo cho một session riêng để download.
   * API này yêu cầu gửi cho FShare địa chỉ đầy đủ cùa file, `token` 
   * lấy được sau khi đăng nhập, và mật mã của file nếu có.
   */
  response = await fetch(`${API_URL}/session/download`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: `https://www.fshare.vn/file/${id}`,
      token,
      password,
    }),
  });

  /**
   * Nếu thành công, FShare sẽ trả về JSON với `location` chứa link tải
   * trực tiếp từ FShare.
   */
  const body = await response.json()
  const { location } = body;

  /**
   * Nếu thất bại, FShare sẽ trả về `{code: 201, msg: "Not logged in yet!"}`.
   * Điều này xảy ra vì nhiều lý do, nhưng đơn giản nhất là yêu cầu người
   * dùng đăng nhập lại.
   */
  if (!location) {
    return authResponse;
  }

  /**
   * Với link trực tiếp này, chúng ta có thể yêu cầu file từ FShare và
   * trả về cho user để stream.
   */
  return fetch(location, {
    method: "GET",
    headers,
  });
}
