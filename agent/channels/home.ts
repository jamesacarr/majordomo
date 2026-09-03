import { disableRoute } from 'eve/channels';

// No web front door. The health route under /eve/v1 stays for uptime checks.
export default disableRoute();
