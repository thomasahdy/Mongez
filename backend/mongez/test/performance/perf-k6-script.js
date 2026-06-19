import http from 'k6/http';
import { check, sleep } from 'k6';
import ws from 'k6/ws';

export const options = {
  stages: [
    { duration: '10s', target: 5 }, // Ramp up
    { duration: '20s', target: 10 }, // Sustained load
    { duration: '10s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete within 500ms
    http_req_failed: ['rate<0.05'],   // Less than 5% failed requests
  },
};

const BASE_URL = 'http://localhost:3000/api/v1';
const WS_URL = 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket';

// setup() runs ONCE before the load test. We create a pool of authenticated users
// and their associated Spaces, Departments, Boards, and Columns here, avoiding
// the bcrypt bottleneck during the actual load test execution.
export function setup() {
  const numUsers = 5;
  const userPool = [];

  for (let i = 1; i <= numUsers; i++) {
    const email = `k6-user-${i}-${Date.now()}@mongez.test`;
    const password = `Password123!`;
    const name = `K6 User ${i}`;

    const headers = { 'Content-Type': 'application/json' };

    // 1. Register User
    const registerPayload = JSON.stringify({ email, password, name });
    const regRes = http.post(`${BASE_URL}/auth/register`, registerPayload, { headers });
    
    let token = '';
    if (regRes.status === 201) {
      const body = JSON.parse(regRes.body);
      token = body.data.accessToken;
    } else {
      // If registration failed (e.g. email already exists), attempt login
      const loginPayload = JSON.stringify({ email, password });
      const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers });
      if (loginRes.status === 200) {
        const body = JSON.parse(loginRes.body);
        token = body.data.accessToken;
      }
    }

    if (!token) {
      console.log(`Failed to authenticate user ${email}`);
      continue;
    }

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // 2. Create Space
    const spacePayload = JSON.stringify({
      name: `K6 Space ${i}`,
      prefix: `K6${i}`,
      description: `Performance testing space for user ${i}`,
    });
    const spaceRes = http.post(`${BASE_URL}/spaces`, spacePayload, { headers: authHeaders });
    if (spaceRes.status !== 201) {
      console.log(`Failed to create Space for user ${i}: ${spaceRes.status} ${spaceRes.body}`);
      continue;
    }
    const spaceId = JSON.parse(spaceRes.body).data.id;

    // 3. Create Department
    const deptPayload = JSON.stringify({
      name: `K6 Dept ${i}`,
      description: `Performance testing department for user ${i}`,
    });
    const deptRes = http.post(`${BASE_URL}/spaces/${spaceId}/departments`, deptPayload, { headers: authHeaders });
    if (deptRes.status !== 201) {
      console.log(`Failed to create Department for user ${i}: ${deptRes.status} ${deptRes.body}`);
      continue;
    }
    const deptId = JSON.parse(deptRes.body).data.id;

    // 4. Create Board
    const boardPayload = JSON.stringify({
      name: `K6 Board ${i}`,
      type: 'KANBAN',
      departmentId: deptId,
    });
    const boardRes = http.post(`${BASE_URL}/boards`, boardPayload, { headers: authHeaders });
    if (boardRes.status !== 201) {
      console.log(`Failed to create Board for user ${i}: ${boardRes.status} ${boardRes.body}`);
      continue;
    }
    const boardData = JSON.parse(boardRes.body).data;
    const boardId = boardData.id;
    const columnId = boardData.columns && boardData.columns.length > 0 ? boardData.columns[0].id : '';

    userPool.push({
      email,
      token,
      spaceId,
      boardId,
      columnId,
      spacePrefix: `K6${i}`,
    });
  }

  console.log(`Setup complete. Created ${userPool.length} test environments.`);
  return { userPool };
}

export default function (data) {
  const pool = data.userPool;
  if (!pool || pool.length === 0) {
    console.log('User pool is empty, skipping VU iteration');
    return;
  }

  // Assign a user from the pool based on virtual user ID (VU)
  const user = pool[__VU % pool.length];
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token}`,
    },
  };

  // 1. HTTP Endpoint Test - Read Board Tasks
  const readRes = http.get(`${BASE_URL}/boards/${user.boardId}/tasks`, params);
  check(readRes, {
    'GET tasks status is 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 2. HTTP Endpoint Test - Create (Mutate) Task
  const createTaskPayload = JSON.stringify({
    title: `Task VU ${__VU} Iter ${__ITER}`,
    boardId: user.boardId,
    columnId: user.columnId,
    spaceId: user.spaceId,
    spacePrefix: user.spacePrefix,
    status: 'TODO',
    priority: 'MEDIUM',
  });
  const writeRes = http.post(`${BASE_URL}/tasks`, createTaskPayload, params);
  check(writeRes, {
    'POST task status is 201': (r) => r.status === 201,
  });

  let taskId = '';
  if (writeRes.status === 201) {
    taskId = JSON.parse(writeRes.body).data.id;
  }

  sleep(0.5);

  if (taskId) {
    // 3. HTTP Endpoint Test - Update Task Title
    const updateTaskPayload = JSON.stringify({
      title: `Task VU ${__VU} Iter ${__ITER} (Updated)`,
    });
    const updateRes = http.patch(`${BASE_URL}/tasks/${taskId}`, updateTaskPayload, params);
    check(updateRes, {
      'PATCH task status is 200': (r) => r.status === 200,
    });

    sleep(0.5);
  }

  // 4. WebSocket Simulation
  // Establish connection, perform namespace handshake, join board room, and send typing heartbeat
  const wsHeaders = {
    'Authorization': `Bearer ${user.token}`,
  };

  ws.connect(WS_URL, { headers: wsHeaders }, function (socket) {
    socket.on('open', function () {
      // Send connection request to the '/ws' namespace in socket.io format
      socket.send('40/ws,');
    });

    socket.on('message', function (msg) {
      // If we receive a connect confirmation for the namespace
      if (msg.startsWith('40/ws,')) {
        // Join the board room
        socket.send(`42/ws,["join:board","${user.boardId}"]`);

        // If a task was created, join task and emit typing activity
        if (taskId) {
          socket.send(`42/ws,["join:task","${taskId}"]`);
          socket.send(`42/ws,["task:typing",{"taskId":"${taskId}","isTyping":true}]`);
        }
      } else if (msg === '2') {
        // Respond to Engine.IO ping with pong
        socket.send('3');
      }
    });

    // Send a Socket.IO ping/heartbeat after 2 seconds, then close the connection
    socket.setTimeout(function () {
      socket.send('2');
    }, 2000);

    socket.setTimeout(function () {
      socket.close();
    }, 4000);
  });

  sleep(1);
}
