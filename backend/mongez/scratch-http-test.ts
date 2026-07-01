import axios from 'axios';
import FormData from 'form-data';

async function main() {
  const email = 'dean@fcai.edu.eg';
  const password = 'Test@1234';
  const baseUrl = 'http://[::1]:3000/api/v1';

  try {
    console.log(`Logging in as ${email}...`);
    const loginRes = await axios.post(`${baseUrl}/auth/login`, { email, password });
    const token = loginRes.data.data.accessToken;
    console.log('Login successful! Access token received.');

    const client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('\n========================================\nUploading test file...\n========================================');
    
    const form = new FormData();
    const fileBuffer = Buffer.from('Hello world! This is a test file for Cloudflare R2 upload.');
    form.append('file', fileBuffer, {
      filename: 'r2-test-file.txt',
      contentType: 'text/plain',
    });

    try {
      const res = await client.post('/tasks/task_dept_fcai_se_lab_set_3/files', form, {
        headers: form.getHeaders(),
      });
      console.log(`STATUS: ${res.status}`);
      console.log('RESPONSE:', JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      console.log(`FAILED! Status: ${err.response?.status}`);
      console.log('Error Response:', JSON.stringify(err.response?.data, null, 2));
    }

  } catch (err: any) {
    console.error('Error during testing:', err);
  }
}

main();
