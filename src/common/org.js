export function normalizeText(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function extractOrgUsers(organization) {
  const users = new Set();
  const userDetails = new Map();

  function processNode(node) {
    if (!node?.name) return;
    const normalizedName = normalizeText(node.name);
    users.add(normalizedName);
    userDetails.set(normalizedName, {
      originalName: node.name,
      username: node.username,
      title: node.title
    });
    if (Array.isArray(node.directReports) && node.directReports.length > 0) {
      node.directReports.forEach(processNode);
    }
  }

  organization.forEach(processNode);
  return { users, userDetails };
}

export function countTotalRDPeople(organization) {
  let count = 0;
  function countPeople(nodes) {
    for (const person of nodes) {
      count++;
      if (Array.isArray(person.directReports) && person.directReports.length > 0) {
        countPeople(person.directReports);
      }
    }
  }
  countPeople(organization);
  return count;
}

/**
 * Extract all people under a specific manager (Engineering team under Petr Švihlík)
 */
export function extractEngineeringTeam(organization) {
  // Default behavior: return everyone as part of engineering unless a specific
  // manager/team is provided in future configs.
  const engineeringUsers = new Set();
  function collectAll(person) {
    if (person?.name) engineeringUsers.add(normalizeText(person.name));
    if (Array.isArray(person?.directReports)) person.directReports.forEach(collectAll);
  }
  organization.forEach(collectAll);
  return engineeringUsers;
}