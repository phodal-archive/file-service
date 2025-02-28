[StartOfDocument .]
[CursorSurroundingLines]
\"\"\"
Agent Service API
\346\217\220\344\276\233\345\237\272\344\272\216FastAPI\347\232\204Agent\346\234\215\345\212\241\346\216\245\345\217\243
\"\"\"
import json
import logging
import uuid
from typing import Dict, Optional, List, AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from codegeex_mcp.api.agent_api import CodeGeexAgentAPI, AgentResponse
import asyncio

# \351\205\215\347\275\256\346\227\245\345\277\227
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# \345\210\233\345\273\272FastAPI\345\272\224\347\224\250
app = FastAPI(title=\"CodeGeeX Agent API\")

# \351\205\215\347\275\256CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[\"*\"],
    allow_credentials=True,
    allow_methods=[\"*\"],
    allow_headers=[\"*\"],
)

[/CursorSurroundingLines]
[Class or Interface SessionManager in lines 62-83]
Class SessionManager:
\tDocstring: \344\274\232\350\257\235\347\256\241\347\220\206\345\231\250\357\274\214\347\256\241\347\220\206\346\211\200\346\234\211Agent\344\274\232\350\257\235
\tFields:
\t\tdef __init__(self):
\t\t        self.sessions: Dict[str, AgentSession] = {}
\tMethods:
\t\t# \345\210\233\345\273\272\346\226\260\344\274\232\350\257\235
\t\tcreate_session(self)
\t\t# \350\216\267\345\217\226\344\274\232\350\257\235
\t\tget_session(self, session_id: str)
\t\t# \345\205\263\351\227\255\344\274\232\350\257\235
\t\tclose_session(self, session_id: str)
<...22 lines in source code not shown...>
[/Class or Interface]


# \345\205\250\345\261\200\344\274\232\350\257\235
agent_session = AgentSession()

<...3 more lines from [Code Snippet (84-91) in lines 84-91] not shown...>
[Class or Interface AgentRequest in lines 92-97]
Class AgentRequest:
\tDocstring: \350\257\267\346\261\202\346\250\241\345\236\213
\tFields:
\t\ttype: str
\t\tmodule: str
\t\tcontent: Dict[str, str]
\t\tsession_id: Optional[str] = None

<...6 lines in source code not shown...>
[/Class or Interface]
[Function process_stream in lines 100-150]
# \345\244\204\347\220\206\346\265\201\345\274\217\345\223\215\345\272\224
process_stream(session: AgentSession, message: str)
<...51 lines in source code not shown...>
[/Function]
[Function create_session in lines 152-174]
# \345\210\233\345\273\272\346\226\260\347\232\204Agent\344\274\232\350\257\235
#     
#     \350\277\224\345\233\236\346\240\274\345\274\217:
#     {
#         \"type\": \"agent\",
#         \"content\": {
#             \"session_id\": \"xxx-xxx-xxx\"
#         }
#     }
#     
create_session()
<...23 lines in source code not shown...>
[/Function]
[Function agent in lines 176-214]
# \345\244\204\347\220\206Agent\350\257\267\346\261\202
#     
#     \350\257\267\346\261\202\346\240\274\345\274\217:
#     {
#         \"type\": \"query\",
#         \"module\": \"agent\",
#         \"content\": {
#             \"type\": \"text\",
#             \"text\": \"xxx\"
#         },
#         \"session_id\": \"xxx-xxx-xxx\"  // \345\217\257\351\200\211
#     }
#     
agent(request: AgentRequest)
<...39 lines in source code not shown...>
[/Function]
[Function close_session in lines 216-228]
# \345\205\263\351\227\255Agent\344\274\232\350\257\235
close_session(session_id: str)
<...13 lines in source code not shown...>
[/Function]
[Function startup_event in lines 231-238]
# \345\272\224\347\224\250\345\220\257\345\212\250\346\227\266\345\210\235\345\247\213\345\214\226\346\211\200\346\234\211\344\274\232\350\257\235
startup_event()
<...8 lines in source code not shown...>
[/Function]
[Function shutdown_event in lines 241-248]
# \345\272\224\347\224\250\345\205\263\351\227\255\346\227\266\346\270\205\347\220\206\346\211\200\346\234\211\344\274\232\350\257\235
shutdown_event()
<...8 lines in source code not shown...>
[/Function]

if __name__ == \"__main__\":
    import uvicorn
    uvicorn.run(app, host=\"0.0.0.0\", port=8000)

[EndOfDocument .]

 If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines
