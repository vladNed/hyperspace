export async function importPubKey(pubKey: string): Promise<CryptoKey> {
  const jsonExported = atob(pubKey);
  const exported = JSON.parse(jsonExported);
  try {
    return await window.crypto.subtle.importKey(
      "jwk",
      exported,
      { name: "ECDH", namedCurve: "P-384" },
      true,
      [],
    );
  } catch (error) {
    console.error("JWK KEY: Could not import key", error);
    throw error;
  }
}

export class Identity {
  private sharedSecret: CryptoKey | null = null;

  private constructor(private readonly _keyPair: CryptoKeyPair) {}

  static async init(): Promise<Identity> {
    let newKeyPair = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-384" },
      true,
      ["deriveKey"],
    );
    return new Identity(newKeyPair);
  }

  async exportPubKey(): Promise<string> {
    const exported = await window.crypto.subtle.exportKey(
      "jwk",
      this._keyPair.publicKey,
    );
    const jsonExported = JSON.stringify(exported, null, " ");

    return btoa(jsonExported);
  }

  async deriveSharedSecret(pubKey: CryptoKey): Promise<void> {
    try {
      this.sharedSecret = await window.crypto.subtle.deriveKey(
        {
          name: "ECDH",
          public: pubKey,
        },
        this._keyPair.privateKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
    } catch (error) {
      console.error("PEER ERROR: Could not derive shared secrets");
      throw error;
    }
  }

  async encrypt(data: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.sharedSecret) {
      throw new Error("Shared secret not derived");
    }

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.sharedSecret,
      data,
    );

    return Identity.appendBuffer(iv.buffer, encrypted);
  }

  private static appendBuffer(
    buffer1: ArrayBuffer,
    buffer2: ArrayBuffer,
  ): ArrayBuffer {
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  }

  async decrypt(data: ArrayBuffer): Promise<ArrayBuffer> {
    if (!this.sharedSecret) {
      throw new Error("Shared secret not derived");
    }

    try {
      const iv = new Uint8Array(data.slice(0, 12));
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        this.sharedSecret,
        data.slice(12),
      );

      return decrypted;
    } catch (error) {
      console.error(
        "PEER ERROR: Could not decrypt message. Size:",
        data.byteLength,
      );
      throw error;
    }
  }
}
