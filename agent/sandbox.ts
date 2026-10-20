import { defineSandbox } from 'eve/sandbox';
import { JustBashSandbox } from 'eve/sandbox/just-bash';

// Nothing uses the sandbox: bash, read_file and write_file are disabled. eve
// still prepares one at build time, so pick the pure-JavaScript provider to
// avoid needing Docker locally or a Vercel Sandbox snapshot on every deploy.
export const environment = JustBashSandbox.environment();
export default defineSandbox(() => environment.open());
