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


