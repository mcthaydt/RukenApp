import { generateKeyPairSync, type KeyObject } from "node:crypto";

/**
 * A fresh RSA key pair, made when a test asks for it and never kept: no key is a file in the repository. The private
 * key comes in the two PEM forms the GitHub App code must accept: PKCS#1 (what GitHub downloads) and PKCS#8.
 */
export function freshRsaKey(): { pkcs1Pem: string; pkcs8Pem: string; publicKey: KeyObject } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    pkcs1Pem: privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
    pkcs8Pem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey,
  };
}
