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
const RUST_BIN = process.platform === 'win32'
  ? path.join(RUST_BIN_DIR, 'target', 'release', 'prodef-runtime-rust.exe')
  : path.join(RUST_BIN_DIR, 'target', 'release', 'prodef-runtime-rust');

app.post('/execute', (req, res) => {
  const tmpRequest = path.join(os.tmpdir(), `prodef_exec_request_${Date.now()}.json`);
  fs.writeFileSync(tmpRequest, JSON.stringify(req.body));

  execFile(RUST_BIN, ['--exec-request', tmpRequest], { cwd: RUST_BIN_DIR }, (err, stdout, stderr) => {
    try {
      fs.unlinkSync(tmpRequest);
    } catch {
    }

    if (err) {
      return res.status(500).json({ error: stderr || err.message });
    }

    res.json(JSON.parse(stdout));
  });
});

const port = parseInt(process.env.PRODEF_UI_API_PORT || '5180', 10);

app.listen(port, () => {
  console.log(`Prodef bridge running at http://localhost:${port}`);
});
