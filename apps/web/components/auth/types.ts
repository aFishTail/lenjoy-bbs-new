export type Mode = "login" | "register";

export type ApiResponse<T> = {
  success: boolean;
  code: string;
  message: string;
  data: T;
};

export type CaptchaMetadata = {
  captchaId: string;
  imageUrl: string;
  expireAt: number;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string | null;
  phone: string | null;
};

export type AuthData = {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
};
