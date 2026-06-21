export type CoderType = "json" | "base64";
export type CoderMode = "encode" | "decode";

export function transformCoderText(input: string, type: CoderType, mode: CoderMode): string {
  if (type === "base64") return mode === "encode" ? encodeBase64(input) : decodeBase64(input);
  if (mode === "encode") return JSON.stringify(input);
  return JSON.stringify(JSON.parse(input), null, 2);
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
