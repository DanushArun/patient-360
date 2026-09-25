import { BASIC_CHALLENGE, parseBasicAuthorization, unauthorized } from "./session-security";

export { BASIC_CHALLENGE, unauthorized };

export function loginFromAuthorization(value: string | null) {
  return parseBasicAuthorization(value);
}
