const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const RUST_BIN_DIR = path.resolve(__dirname, '..', 'prodef-runtime-rust');
const DEFAULT_RUST_BIN = process.platform === 'win32'
  ? path.join(RUST_BIN_DIR, 'target', 'release', 'prodef-runtime-rust.exe')
  : path.join(RUST_BIN_DIR, 'target', 'release', 'prodef-runtime-rust');
const RUST_BIN = process.env.PRODEF_RUST_BIN || DEFAULT_RUST_BIN;

function runRustRequest(payload, onSuccess, res) {
  const stamp = Date.now();
  const tmpRequest = path.join(os.tmpdir(), `prodef_exec_request_${stamp}.json`);

  try {
    fs.writeFileSync(tmpRequest, JSON.stringify(payload, null, 2));
  } catch {
    return res.status(500).json({ error: 'Failed to write temporary request file' });
  }

  if (!fs.existsSync(RUST_BIN)) {
    try {
      fs.unlinkSync(tmpRequest);
    } catch {
    }
    return res.status(500).json({
      error: `Rust binary not found at '${RUST_BIN}'. Build it first with 'cargo build --release' in prodef-runtime-rust or set PRODEF_RUST_BIN.`,
    });
  }

  const args = ['--exec-request', tmpRequest];
  execFile(RUST_BIN, args, { cwd: RUST_BIN_DIR, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    try {
      fs.unlinkSync(tmpRequest);
    } catch {
    }

    if (err) {
      const message = (stderr && stderr.trim()) || err.message || 'Rust execution request failed';
      return res.status(500).json({ error: message });
    }

    try {
      const parsed = JSON.parse(stdout);
      onSuccess(parsed);
    } catch {
      res.status(500).json({ error: 'Failed to parse execution output', raw: stdout });
    }
  });
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/execute', (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Missing execution request JSON body' });
  }

  runRustRequest(payload, (parsed) => {
    res.json(parsed);
  }, res);
});

const basePort = parseInt(process.env.PRODEF_UI_API_PORT || '5180', 10);
let port = basePort;

const tryListen = () => {
  const server = app
    .listen(port, () => {
      console.log(`Prodef API server running at http://localhost:${port}`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} in use, trying next port...`);
        port += 1;
        if (port > basePort + 10) {
          console.error('No available port found in range.');
          process.exit(1);
        }
        tryListen();
      } else {
        console.error('Server error:', err);
        process.exit(1);
      }
    });
};

tryListen();
