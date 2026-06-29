import axios from 'axios';

async function testHttp() {
  // Let's try IPv6 loopback since WSL is mapped to [::1] or localhost
  const baseURL = 'http://[::1]:3000/api/v1';

  try {
    console.log('🔑 Logging in as thomas@mongez.io via IPv6 [::1]...');
    const loginRes = await axios.post(`${baseURL}/auth/login`, {
      email: 'thomas@mongez.io',
      password: 'Test@1234'
    });

    const token = loginRes.data?.data?.accessToken || loginRes.data?.accessToken;
    if (!token) {
      console.error('❌ Failed to get access token from login response:', loginRes.data);
      return;
    }

    console.log('✅ Logged in successfully! Token obtained.');

    // Get notifications
    console.log('📬 Fetching notifications...');
    const notifsRes = await axios.get(`${baseURL}/notifications`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const notifications = notifsRes.data?.data?.data || notifsRes.data?.data || notifsRes.data?.items || [];
    console.log(`Found ${notifications.length} notifications.`);
    if (notifications.length === 0) {
      console.log('❌ No notifications found.');
      return;
    }

    const notif = notifications[0];
    console.log(`Selected Notification ID: ${notif.id}, Title: "${notif.title}", Status: ${notif.status}`);

    // Call patch markAsRead
    console.log(`⚡ Patching /notifications/${notif.id}/read...`);
    const patchRes = await axios.patch(
      `${baseURL}/notifications/${notif.id}/read`,
      null,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    console.log('🟢 Response status:', patchRes.status);
    console.log('🟢 Response headers:', patchRes.headers);
    console.log('🟢 Response data:', patchRes.data);

  } catch (err: any) {
    console.error('❌ HTTP Error occurred:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  }
}

testHttp();
