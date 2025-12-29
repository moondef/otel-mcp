import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('example-app');

// Simulate some async work
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simulate a database query
async function queryDatabase(query) {
  return tracer.startActiveSpan('db.query', async (span) => {
    span.setAttribute('db.system', 'postgresql');
    span.setAttribute('db.statement', query);

    // Simulate query time
    await sleep(50 + Math.random() * 100);

    span.end();
    return [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
  });
}

// Simulate an external API call
async function callExternalApi(endpoint) {
  return tracer.startActiveSpan('http.client', async (span) => {
    span.setAttribute('http.method', 'GET');
    span.setAttribute('http.url', `https://api.example.com${endpoint}`);

    // Simulate network latency
    await sleep(100 + Math.random() * 200);

    // Randomly fail sometimes
    if (Math.random() < 0.2) {
      span.setAttribute('http.status_code', 500);
      span.setStatus({ code: 2, message: 'Internal Server Error' });
      span.end();
      throw new Error('External API failed');
    }

    span.setAttribute('http.status_code', 200);
    span.end();
    return { success: true };
  });
}

// Simulate processing a request
async function handleRequest(requestId) {
  return tracer.startActiveSpan('handleRequest', async (span) => {
    span.setAttribute('request.id', requestId);

    try {
      console.log(`Processing request ${requestId}...`);

      // Query the database
      const users = await queryDatabase('SELECT * FROM users WHERE active = true');
      span.setAttribute('user.count', users.length);

      // Call external API
      await callExternalApi('/notifications');

      // Some processing time
      await sleep(20);

      span.setStatus({ code: 1 });
      console.log(`Request ${requestId} completed successfully`);
    } catch (error) {
      span.setStatus({ code: 2, message: error.message });
      span.setAttribute('error', true);
      span.setAttribute('exception.message', error.message);
      console.log(`Request ${requestId} failed: ${error.message}`);
    } finally {
      span.end();
    }
  });
}

// Main loop - generate some traffic
async function main() {
  console.log('Example app started. Generating traces...');
  console.log('Make sure otel-mcp is running: pnpm dev\n');

  let requestId = 0;

  // Generate requests every 2 seconds
  while (true) {
    requestId++;
    await handleRequest(requestId);
    await sleep(2000);
  }
}

main().catch(console.error);
