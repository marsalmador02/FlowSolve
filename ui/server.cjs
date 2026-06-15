const express = require('express');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Carpeta del runtime Rust dentro del monorepo.
const RUST_BIN_DIR = path.resolve(__dirname, '..', 'prodef-runtime-rust');

// Ruta por defecto del binario compilado en modo release.
const DEFAULT_RUST_BIN = process.platform === 'win32'
  ? path.join(RUST_BIN_DIR, 'target', 'release', 'prodef-runtime-rust.exe')
  : path.join(RUST_BIN_DIR, 'target', 'release', 'prodef-runtime-rust');

const RUST_BIN = DEFAULT_RUST_BIN;

function runRustRequest(payload, onSuccess, res) {
  const stamp = Date.now();
  // Se crea un request temporal por cada llamada /execute.
  const tmpRequest = path.join(os.tmpdir(), `prodef_exec_request_${stamp}.json`);

  try {
    fs.writeFileSync(tmpRequest, JSON.stringify(payload, null, 2));
  } catch {
    return res.status(500).json({ error: 'Failed to write temporary request file' });
  }

  if (!fs.existsSync(RUST_BIN)) {
    try {
      // Limpieza del request temporal si no hay binario.
      fs.unlinkSync(tmpRequest);
    } catch {
    }
    return res.status(500).json({
      error: `Rust binary not found at '${RUST_BIN}'. Build it first with 'cargo build --release' in prodef-runtime-rust.`,
    });
  }

  const args = ['--exec-request', tmpRequest];
  // Runs the Rust binary as a child process and captures stdout/stderr.
  // example: prodef-runtime-rust.exe --exec-request C:\Users\ASUS\AppData\Local\Temp\prodef_exec_request_1697040000000.json
  // example RUST_BIN -> C:\Users\ASUS\Desktop\TTFFGG\FlowSolve\prodef-runtime-rust\target\release\prodef-runtime-rust.exe
  // example args -> [ '--exec-request', 'C:\\Users\\ASUS\\AppData\\Local\\Temp\\prodef_exec_request_1697040000000.json' ]
  execFile(RUST_BIN, args, { cwd: RUST_BIN_DIR, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    try {
      // Siempre intentamos borrar el request temporal al finalizar.
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

app.post('/execute', (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Missing execution request JSON body' });
  }

  // Forwards the request to the Rust runtime and returns the response to the UI client.
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
