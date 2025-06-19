let socket;
let clientId, targetId;
let dhKeys, sharedSecretKey;

const log = (msg) => {
  document.getElementById('log').textContent += msg + '\n';
};

// Step 1: Generate Diffie-Hellman key pair
async function generateDHKeys() {
  return crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// Step 2: Export public key to send to server
async function exportPublicKey(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

// Step 3: Import peer public key
async function importPeerPublicKey(base64) {
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    binary,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

// Step 4: Derive shared AES key
async function deriveAESKey(privateKey, publicKey) {
  return crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// Step 5: Connect and exchange public keys
async function connect() {
  clientId = document.getElementById('clientId').value.trim();
  targetId = document.getElementById('targetId').value.trim();

  if (!clientId || !targetId) return alert("Both IDs required");

  dhKeys = await generateDHKeys();
  const publicKeyBase64 = await exportPublicKey(dhKeys.publicKey);

  socket = new WebSocket('ws://localhost:3001');

  socket.onopen = () => {
    log("Connected to server");
    socket.send(JSON.stringify({ type: "register", clientId }));
    socket.send(JSON.stringify({ type: "send", to: targetId, payload: publicKeyBase64 }));
    log("Sent public key to " + targetId);
  };

  socket.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    if (!msg || !msg.payload) return;

    if (!msg.isFile) {
      log("Received public key from " + msg.from);
      const peerKey = await importPeerPublicKey(msg.payload);
      sharedSecretKey = await deriveAESKey(dhKeys.privateKey, peerKey);
      log("Shared AES key established");
    } else {
      const blob = await decryptFile(msg.payload);
      downloadFile(blob, 'received_file');
      log("Received and decrypted file from " + msg.from);
    }
  };
}

// Step 6: Encrypt and send file
async function sendFile() {
  const fileInput = document.getElementById("fileInput");
  const file = fileInput.files[0];
  if (!file || !sharedSecretKey) return alert("File or shared key missing");

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileData = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedSecretKey,
    fileData
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  const payload = btoa(String.fromCharCode(...combined));
  socket.send(JSON.stringify({ type: "send", to: targetId, payload, isFile: true }));
  log("Sent encrypted file to " + targetId);
}

// Step 7: Decrypt received file
async function decryptFile(base64) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedSecretKey,
    ciphertext
  );

  return new Blob([decrypted]);
}

// Helper to download file
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
