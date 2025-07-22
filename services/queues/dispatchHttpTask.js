const { CloudTasksClient } = require('@google-cloud/tasks');

// Instantiates a client.
const client = new CloudTasksClient();

export default async function createHttpTaskWithToken(url, httpMethod, payload = null, seconds = null) {
  const project = 'sargood-359200';
  const queue = 'sargood-359200';
  const location = 'asia-southeast2';
  const serviceAccountEmail = 'sargood-cloud-run@sargood-359200.iam.gserviceaccount.com';

  // Construct the fully qualified queue name.
  const parent = client.queuePath(project, location, queue);

  const task = {
    httpRequest: {
      httpMethod: httpMethod,
      headers: {
        'Content-Type': 'application/json',
      },
      url,
      oidcToken: {
        serviceAccountEmail,
      },
    },
  };

  if (payload) {
    task.httpRequest.body = Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  if (seconds) {
    task.scheduleTime = {
      seconds: parseInt(seconds) + Date.now() / 1000,
    }
  }

  console.log('Sending task:');
  // Send create task request.
  const request = { parent: parent, task: task };
  const [response] = await client.createTask(request);
  const name = response.name;
  console.log(`Created task ${name}`);
}

export function dispatchHttpTaskHandler(type, payload = null, seconds = null) {
  let url;
  let httpMethod;

  switch (type) {
    case 'booking':
      url = process.env.APP_URL + '/api/bookings/service-task';
      httpMethod = 'POST';
      break;
    default:
      break;

  }

  if (url && httpMethod) {
    createHttpTaskWithToken(url, httpMethod, payload, seconds);
  }
}