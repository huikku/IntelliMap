import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function serveCommand(options) {
  console.log(`🚀 Starting IntelliMap server on port ${options.port}...`);
  
  try {
    const serverPath = join(__dirname, '../../server/server.js');
    
    const serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        PORT: options.port,
        WATCH: options.watch ? 'true' : 'false',
      },
      stdio: 'inherit',
    });
    
    serverProcess.on('error', (error) => {
      console.error('❌ Server error:', error.message);
      process.exit(1);
    });
    
    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`❌ Server exited with code ${code}`);
        process.exit(code);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

