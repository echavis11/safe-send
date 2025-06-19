import crypto from 'crypto';

export function generateDHKeys(primeLength = 2048) {
  const dh = crypto.createDiffieHellman(primeLength);
  dh.generateKeys();
  return {
    publicKey: dh.getPublicKey('base64'),
    privateKey: dh.getPrivateKey('base64'),
    dhObject: dh, // needed to compute shared secret
  };
}

export function computeSharedSecret(dhObject, otherPublicKeyBase64) {
  const otherKey = Buffer.from(otherPublicKeyBase64, 'base64');
  return dhObject.computeSecret(otherKey).toString('base64');
}