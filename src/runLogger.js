import fs from 'fs';
import path from 'path';

function saveRun(data) {
  try {
    const dir = path.join(process.cwd(), 'output', 'runs');
    fs.mkdirSync(dir, { recursive: true });

    const slug = (data.input || data.keyword || 'run')
      .replace(/https?:\/\//g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .slice(0, 40);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${timestamp}-${slug}.json`;

    fs.writeFileSync(
      path.join(dir, filename),
      JSON.stringify({ savedAt: new Date().toISOString(), ...data }, null, 2)
    );
  } catch {
    // non-blocking — log failures silently
  }
}

export { saveRun };
