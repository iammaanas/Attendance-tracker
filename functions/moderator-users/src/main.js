import { Client, Account, Teams, Users, Query } from 'node-appwrite';

const MODERATOR_TEAM_ID = '6a89049f001c27b0bde8';
const MODERATOR_ROLE = 'moderator';

function clientFromJwt(jwt) {
  return new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setJWT(jwt);
}

function adminClient() {
  return new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_FUNCTION_API_KEY);
}

export default async ({ req, res, log }) => {
  try {
    const jwt = req.headers['x-appwrite-user-jwt'];
    if (!jwt) {
      return res.json({ error: 'Authentication required.' }, 401);
    }

    // Authenticate the caller with their own Appwrite session/JWT.
    const userClient = clientFromJwt(jwt);
    const account = new Account(userClient);
    const currentUser = await account.get();

    // Use the function's server-side key for the membership lookup.
    // A valid team member is not necessarily allowed to list memberships
    // with their own JWT. The caller is still authenticated above, and the
    // verified user ID is used to check the membership and moderator role.
    const adminTeams = new Teams(adminClient());
    const memberships = await adminTeams.listMemberships({
      teamId: MODERATOR_TEAM_ID,
      queries: [Query.equal('userId', currentUser.$id)],
      total: false
    });

    const isModerator = memberships.memberships?.some(membership =>
      membership.userId === currentUser.$id &&
      Array.isArray(membership.roles) &&
      membership.roles.includes(MODERATOR_ROLE)
    );

    if (!isModerator) {
      return res.json({ error: 'Moderator access required.' }, 403);
    }

    // The Users API is intentionally used only inside the Function.
    // Its dynamic API key never reaches the browser.
    const usersService = new Users(adminClient());
    const users = [];
    const pageSize = 100;
    let offset = 0;

    while (offset < 5000) {
      const result = await usersService.list({
        queries: [Query.limit(pageSize), Query.offset(offset)],
        total: false
      });

      users.push(...(result.users || []).map(user => ({
        id: user.$id,
        name: user.name || '',
        email: user.email || ''
      })));

      if (!result.users || result.users.length < pageSize) break;
      offset += pageSize;
    }

    users.sort((a, b) => {
      if (a.id === currentUser.$id) return -1;
      if (b.id === currentUser.$id) return 1;
      return (a.name || a.email || a.id).localeCompare(b.name || b.email || b.id);
    });

    log(`Moderator ${currentUser.$id} requested ${users.length} users.`);
    return res.json({ users });
  } catch (error) {
    log(`Moderator users function failed: ${error.message}`);
    return res.json({ error: error.message || 'Unable to load users.' }, 500);
  }
};
