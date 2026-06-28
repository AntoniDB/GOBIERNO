SELECT "gameId", "resourceType", COUNT(*) as cnt
FROM "ResourceStock"
GROUP BY "gameId", "resourceType"
HAVING COUNT(*) > 1;
