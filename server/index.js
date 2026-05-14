import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDatabase, getMasterDb, getCompanyDb, initCompanyDb, closeAll } from './config/database.js';
import { authenticate } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import employeeRoutes from './routes/employees.js';
import attendanceRoutes from './routes/attendance.js';
import leaveRoutes from './routes/leave.js';
import advanceRoutes from './routes/advances.js';
import payrollRoutes from './routes/payroll.js';
import notificationRoutes from './routes/notifications.js';
import settingsRoutes from './routes/settings.js';
import archiveRoutes from './routes/archive.js';
import permissionsRoutes from './routes/permissions.js';
import financesRoutes from './routes/finances.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const clientDist = path.join(__dirname, '..', 'client', 'dist');

async function bootstrap() {
  console.log('Initializing database...');
  await initDatabase();
  await initCompanyDb('printing');
  await initCompanyDb('advertising');
  console.log('Database ready.');

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/leave', leaveRoutes);
  app.use('/api/advances', advanceRoutes);
  app.use('/api/payroll', payrollRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/archive', archiveRoutes);
  app.use('/api/permissions', permissionsRoutes);
  app.use('/api/finances', financesRoutes);

  app.get('/api/users/:companySlug', authenticate, async (req, res) => {
    const masterDb = getMasterDb();
    const company = await masterDb.prepare('SELECT * FROM companies WHERE slug = ?').get(req.params.companySlug);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (req.user.role !== 'super_admin' && req.user.company_id !== company.id) {
      return res.status(403).json({ error: 'No access' });
    }
    const users = await masterDb.prepare('SELECT id, username, full_name, email, role FROM users WHERE company_id = ? OR role = ?').all(company.id, 'super_admin');
    res.json(users);
  });

  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

io.on('connection', (socket) => {
  socket.on('join-task', (taskId) => {
    socket.join(`task-${taskId}`);
  });
  socket.on('leave-task', (taskId) => {
    socket.leave(`task-${taskId}`);
  });
  socket.on('task-message', (data) => {
    io.to(`task-${data.taskId}`).emit('new-message', data);
  });
});

function startServer(port) {
  server.listen(port, '0.0.0.0', () => {
    console.log('═══════════════════════════════════════');
    console.log('  ERP System is running!');
    console.log(`  Open: http://localhost:${port}`);
    console.log('═══════════════════════════════════════');
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      server.close();
      startServer(port + 1);
    }
  });
}

const PORT = parseInt(process.env.PORT) || 5000;
bootstrap().then(() => startServer(PORT)).catch(err => { console.error('Startup failed:', err); process.exit(1); });

process.on('SIGINT', async () => { await closeAll(); process.exit(); });
process.on('SIGTERM', async () => { await closeAll(); process.exit(); });
