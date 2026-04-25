// Import SNAP ego-Facebook dataset users and friendships.
// Put these files into Neo4j import directory, then run this file:
// - facebook_users_import.csv
// - facebook_friendships_import.csv
//
// facebook_friendships_import.csv follows the same edge-list form as your Neo4j export:
// startUserId,endUserId

CREATE CONSTRAINT user_userId IF NOT EXISTS
FOR (u:User) REQUIRE u.userId IS UNIQUE;

CREATE CONSTRAINT user_email IF NOT EXISTS
FOR (u:User) REQUIRE u.email IS UNIQUE;

LOAD CSV WITH HEADERS FROM 'file:///facebook_users_import.csv' AS row
MERGE (u:User {userId: row.userId})
SET u.externalId = row.externalId,
    u.email = row.email,
    u.displayName = row.displayName,
    u.passwordHash = row.passwordHash,
    u.bio = row.bio,
    u.avatarUrl = nullif(row.avatarUrl, ''),
    u.coverUrl = nullif(row.coverUrl, ''),
    u.location = row.location,
    u.role = row.role,
    u.status = row.status,
    u.profileVisibility = row.profileVisibility,
    u.source = row.source,
    u.createdAt = row.createdAt,
    u.updatedAt = row.updatedAt,
    u.lastOnlineAt = row.lastOnlineAt;

LOAD CSV WITH HEADERS FROM 'file:///facebook_friendships_import.csv' AS row
MATCH (a:User {userId: row.startUserId})
MATCH (b:User {userId: row.endUserId})
MERGE (a)-[r:FRIENDS_WITH]-(b)
SET r.since = coalesce(r.since, '2026-04-25T00:00:00.000Z'),
    r.source = coalesce(r.source, 'facebook_combined');
