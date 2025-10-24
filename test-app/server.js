// Simple test server to demonstrate runtime analysis

import express from 'express';
import { getUserData } from './lib/users.js';
import { getProductData } from './lib/products.js';
import { processOrder } from './lib/orders.js';
import { sendEmail } from './lib/email.js';
import { logActivity } from './lib/logger.js';

const app = express();
const PORT = 3333;

app.use(express.json());

// This route will be called
app.get('/', (req, res) => {
  logActivity('Homepage visited');
  res.json({ message: 'Welcome to the test app!' });
});

// This route will be called
app.get('/users/:id', async (req, res) => {
  logActivity(`User ${req.params.id} requested`);
  const user = await getUserData(req.params.id);
  res.json(user);
});

// This route will be called
app.get('/products', async (req, res) => {
  logActivity('Products list requested');
  const products = await getProductData();
  res.json(products);
});

// This route will NOT be called (dead code)
app.post('/orders', async (req, res) => {
  logActivity('Order created');
  const order = await processOrder(req.body);
  await sendEmail(order.userEmail, 'Order confirmation');
  res.json(order);
});

// This route will NOT be called (dead code)
app.get('/admin', (req, res) => {
  logActivity('Admin panel accessed');
  res.json({ message: 'Admin panel' });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log('');
  console.log('💡 Try these endpoints:');
  console.log(`   curl http://localhost:${PORT}/`);
  console.log(`   curl http://localhost:${PORT}/users/123`);
  console.log(`   curl http://localhost:${PORT}/products`);
  console.log('');
  console.log('📊 Press Ctrl+C to stop and see runtime analysis');
});

