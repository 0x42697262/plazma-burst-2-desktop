# Messages: opcode, dispatch and send sites

Generated from the game files by `npm run protocol`; build v1769098419. Do not edit by hand.

One row per reliable message. "Opcode line" is where the opcode is assigned in load order,
"first dispatch line" is the first place the receiving side compares against it, and "sent
from" lists the other scripts that put it on the wire. Parts belong in
[protocol.md](protocol.md), where they are read one by one.

| Op | Message | Opcode line | First dispatch line | Sent from |
|---|---|---|---|---|
| 0 | `RELIABLE_RESPONSE` | 86 | 1739 | `scripts/libs/flash.js:1888` `scripts/libs/flash.js:1919` |
| 1 | `RELIABLE_EXEC_TRIGGER` | 87 | 4651 | `scripts/libs/flash.js:5117` `scripts/frame2.js:29318` `scripts/frame2.js:33790` `scripts/frame2.js:35545` `scripts/frame2.js:40575` |
| 2 | `RELIABLE_RESPAWN` | 88 | 3830 | `scripts/frame2.js:42923` |
| 3 | `RELIABLE_GRENADE_THROW` | 89 | - | - |
| 4 | `RELIABLE_HIT_PLAYER` | 90 | 3866 | `scripts/frame2.js:30493` |
| 5 | `RELIABLE_DAMAGE_PLAYERS_VIA_EXPLOSION` | 91 | 3934 | `scripts/libs/flash.js:655` |
| 6 | `RELIABLE_HEAL_PLAYER` | 92 | 3990 | `scripts/frame2.js:35710` |
| 7 | `RELIABLE_PROJECTILE_CREATE` | 93 | 4050 | `scripts/frame2.js:31589` `scripts/frame2.js:35571` |
| 8 | `RELIABLE_PROJECTILE_REMOVE` | 94 | 4241 | `scripts/frame2.js:31619` |
| 9 | `RELIABLE_BARREL` | 95 | 4807 | `scripts/frame2.js:17560` |
| 10 | `RELIABLE_THROW_GUN` | 96 | 4142 | `scripts/frame2.js:35461` |
| 11 | `RELIABLE_HIT_GRENADE` | 97 | 4261 | `scripts/frame2.js:28600` |
| 12 | `RELIABLE_PLAYER_DIES` | 98 | 2082 | `scripts/libs/flash.js:7058` |
| 13 | `RELIABLE_HIT_SHIELD` | 99 | 4556 | `scripts/frame2.js:29076` |
| 14 | `RELIABLE_CHAT` | 101 | 1737 | `scripts/libs/flash.js:1756` `scripts/frame2.js:3956` `scripts/screens/GameScene.js:289` |
| 15 | `RELIABLE_CREATE_MATCH` | 103 | 2667 | `scripts/screens/MPCreateMatch.js:551` |
| 16 | `RELIABLE_AUTHENTICATE` | 104 | 1982 | `scripts/libs/flash.js:1918` `scripts/screens/MPLobby.js:151` |
| 17 | `RELIABLE_LIST_ME_AS_HOST` | 105 | - | - |
| 18 | `RELIABLE_SERVICE_MESSAGE` | 106 | 2042 | `scripts/connection.js:671` |
| 19 | `RELIABLE_GET_MATCH_LIST` | 107 | 2497 | `scripts/screens/MPLobby.js:665` |
| 20 | `RELIABLE_JOIN_MATCH` | 108 | 1738 | `scripts/libs/flash.js:5136` `scripts/screens/GameScene.js:109` `scripts/screens/GameScene.js:1146` `scripts/screens/MPLobby.js:452` `scripts/screens/MPLobby.js:565` |
| 21 | `RELIABLE_MATCH_JOIN_RESPONSE` | 109 | 3315 | `scripts/libs/flash.js:6783` |
| 22 | `RELIABLE_MAP_CHUNK` | 110 | 3268 | `scripts/libs/flash.js:6773` |
| 23 | `RELIABLE_CLIENT_READY_FOR_FIRST_SYNC` | 111 | 1740 | `scripts/frame2.js:14371` |
| 24 | `RELIABLE_FIRST_SYNC_RESPONSE` | 112 | 3421 | `scripts/libs/flash.js:3411` `scripts/libs/flash.js:6799` `scripts/libs/flash.js:6875` |
| 25 | `RELIABLE_MY_PLAYER_PROPERTIES_CHANGED` | 113 | 3526 | `scripts/connection.js:504` `scripts/libs/flash.js:625` `scripts/libs/flash.js:3692` |
| 26 | `RELIABLE_PING` | 114 | 3066 | `scripts/libs/flash.js:861` |
| 27 | `RELIABLE_REPORT_USER` | 115 | 1742 | `scripts/screens/HUD.js:2066` |
| 28 | `RELIABLE_ENDORDSE_USER` | 116 | 1743 | `scripts/screens/HUD.js:2128` |
| 29 | `RELIABLE_KICK_USER` | 117 | 1744 | `scripts/screens/HUD.js:2033` |
| 30 | `RELIABLE_MATCH_INFO_PARTIAL_UDPATE` | 118 | 3292 | `scripts/libs/flash.js:7271` |
| 31 | `RELIABLE_PLAYER_SCORE_UPDATE` | 119 | 2060 | `scripts/libs/flash.js:7165` |
| 32 | `RELIABLE_PLAY_SOUND` | 120 | 3302 | `scripts/libs/flash.js:5990` `scripts/libs/flash.js:5992` `scripts/libs/flash.js:6001` `scripts/libs/flash.js:6329` `scripts/libs/flash.js:6331` `scripts/libs/flash.js:6365` `scripts/libs/flash.js:6367` |
| 33 | `RELIABLE_BAN_USER` | 121 | 1745 | `scripts/screens/HUD.js:2153` |
| 34 | `RELIABLE_RESSURECT` | 122 | 3831 | `scripts/actions.js:1603` `scripts/frame2.js:16070` |
| 35 | `RELIABLE_SWORD_ATTACK` | 123 | 4672 | `scripts/frame2.js:35853` |
| 36 | `RELIABLE_VAR_SYNC` | 124 | 4677 | `scripts/actions.js:3117` `scripts/actions.js:3134` `scripts/actions.js:3151` `scripts/actions.js:3168` `scripts/actions.js:3185` |
| 37 | `RELIABLE_FLOW_AT` | 125 | 4718 | `scripts/frame2.js:6684` |
| 38 | `RELIABLE_AI_STATE_SYNC` | 126 | 4730 | `scripts/frame2.js:8167` `scripts/frame2.js:8190` |
| 39 | `RELIABLE_AI_HEALTH_SYNC` | 127 | 4784 | `scripts/frame2.js:8215` |
| 40 | `RELIABLE_TASK` | 136 | 3730 | - |
| 41 | `RELIABLE_TASK_ASNYC` | 137 | 3751 | - |
| 42 | `RELIABLE_YOU_ARE_STILL_DEAD` | 138 | 3511 | `scripts/libs/flash.js:1109` |
| 43 | `RELIABLE_ENTER_RESPAWN_QUEUE` | 139 | 3775 | `scripts/frame2.js:42276` |
