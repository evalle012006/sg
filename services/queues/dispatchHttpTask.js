import EmailService from '../booking/emailService';

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
        audience: url,
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
  console.log('  URL:', url);
  console.log('  Method:', httpMethod);
  console.log('  Audience:', url);
  
  // Send create task request.
  const request = { parent: parent, task: task };
  const [response] = await client.createTask(request);
  const name = response.name;
  console.log(`Created task ${name}`);
}

export async function dispatchHttpTaskHandler(type, payload = null, seconds = null) {
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
    // Skip queue in local development
    // if (process.env.NODE_ENV === 'development' || !url.startsWith('https://')) {
    //   console.log('⚠️ Local environment detected - processing directly without queue');
      
    //   // Special handling for sendTriggerEmail - send directly instead of using service-task
    //   if (payload?.type === 'sendTriggerEmail') {
    //     console.log('📧 Sending email directly in local development...');
        
    //     try {
    //       const { recipient, templateId, emailData } = payload.payload;
          
    //       // Validate inputs
    //       if (!recipient) {
    //         throw new Error('No recipient specified');
    //       }
    //       if (!templateId) {
    //         throw new Error('No template ID specified');
    //       }
    //       if (!emailData) {
    //         throw new Error('No email data provided');
    //       }
          
    //       await EmailService.sendWithTemplate(recipient, templateId, emailData);
    //       console.log(`✅ Email sent successfully to ${recipient} (local)`);
    //       return { success: true };
    //     } catch (error) {
    //       console.error('❌ Error sending email directly:', error);
    //       throw error;
    //     }
    //   }
      
    //   // For other task types, make HTTP request to service-task
    //   try {
    //     const response = await fetch(url, {
    //       method: httpMethod,
    //       headers: {
    //         'Content-Type': 'application/json',
    //       },
    //       body: JSON.stringify(payload),
    //     });
        
    //     if (!response.ok) {
    //       const errorText = await response.text();
    //       throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    //     }
        
    //     const data = await response.json();
    //     console.log('✅ Task processed directly (no queue)');
    //     return data;
    //   } catch (error) {
    //     console.error('❌ Error processing task directly:', error);
    //     throw error;
    //   }
    // }
    return createHttpTaskWithToken(url, httpMethod, payload, seconds);
  }
}