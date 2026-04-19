Synthetic social graph dataset for Neo4j friend recommendation testing

Node totals:
- Users: 900
- Groups: 90
- Posts: 1800
- Comments: 2200
- Conversations: 180
- Messages: 900
- Notifications: 120
- Stories: 250
- Reports: 60
- Total node rows: 6500

Key business rules applied:
- FRIEND_WITH is 2-way and both directions share the same 'since'
- REQUESTED contains only pending friend requests
- OWNER_OF users are also MEMBER_OF with role='owner'
- Private groups use JOIN_REQUESTED before membership; active requests remain in join_requested.csv
- Group public/private stored in groups.csv -> privacy
- Posts/comments/likes/shares/saves all happen after the relevant user/content creation time

Suggested first import/use for friend recommendation:
1) users.csv
2) groups.csv
3) friend_with.csv
4) member_of.csv
5) requested.csv
6) posts/comments + liked/shared/saved if you want richer signals

All timestamps use ISO format: YYYY-MM-DDTHH:MM:SS