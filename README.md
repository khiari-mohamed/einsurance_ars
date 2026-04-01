# ARS Reinsurance Management System

A comprehensive Enterprise Resource Planning (ERP) system for reinsurance brokerage operations, built for ARS Tunisie (exclusive Aon representative in Tunisia).

## 🎯 Overview

This application manages the complete lifecycle of reinsurance deals:
- Client prospecting and risk placement
- Premium and claims tracking
- Financial settlements and accounting
- Regulatory reporting (bordereaux)
- Document management (GED)

## 🏗️ Architecture

### Backend
- **Framework:** NestJS (Node.js)
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **Authentication:** JWT
- **API:** RESTful

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **UI Library:** Tailwind CSS + Radix UI
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Routing:** React Router v6

## 📋 Features

### 7 Core Modules

1. **Fichier (Configuration)**
   - Company settings
   - User management & RBAC
   - Exchange rates (FX)
   - System utilities

2. **Données (Master Data)**
   - Assurés (Insured clients)
   - Cédantes (Cedants)
   - Réassureurs (Reinsurers)
   - Co-courtiers (Co-brokers)

3. **Affaires (Business Deals)**
   - Facultative reinsurance
   - Treaty reinsurance
   - Commission calculations
   - Status workflow

4. **Sinistres (Claims)**
   - Claims tracking
   - SAP management
   - Cash calls
   - Reinsurer notifications

5. **Finances (Financial Operations)**
   - Cash-in/Cash-out
   - Settlements (situations)
   - Lettrage (reconciliation)
   - Wire orders
   - FX gain/loss

6. **Comptabilité (Accounting)**
   - Automatic journal entries
   - Bordereaux generation
   - Integration file export
   - Treaty statements

7. **GED (Document Management)**
   - Document storage
   - Deal checklists
   - SWIFT confirmations
   - Version control

### Additional Features
- Real-time notifications (WebSocket)
- Dashboard with charts
- PDF generation
- Excel export
- Multi-currency support
- Role-based access control (9 roles)

## 🚀 Quick Start

### Prerequisites
- Node.js 20.x or later
- PostgreSQL 14 or later
- npm or yarn

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ars-reinsurance.git
   cd ars-reinsurance
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database credentials
   npm run build
   npm run start:dev
   ```

3. **Setup Frontend**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Edit .env with your API URL
   npm run dev
   ```

4. **Access Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000/api

5. **Default Login**
   - Email: `admin@ars.tn`
   - Password: `Admin@2024`
   - ⚠️ Change password immediately!

## 🖥️ Production Deployment

### Ubuntu Server Deployment

See detailed guides:
- **Quick Start:** [QUICK_START.md](QUICK_START.md)
- **Full Guide:** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Pre-Deployment Checklist:** [PRE_DEPLOYMENT_CHECKLIST.md](PRE_DEPLOYMENT_CHECKLIST.md)

### Automated Deployment

```bash
# On your Ubuntu server
git clone https://github.com/YOUR_USERNAME/ars-reinsurance.git
cd ars-reinsurance
chmod +x deploy-ubuntu.sh
sudo ./deploy-ubuntu.sh
```

The script will:
- ✅ Install PostgreSQL, Node.js, Nginx
- ✅ Setup database
- ✅ Build and deploy backend & frontend
- ✅ Configure Nginx reverse proxy
- ✅ Setup PM2 process manager
- ✅ Configure automatic backups

## 📁 Project Structure

```
ars-reinsurance/
├── backend/
│   ├── src/
│   │   ├── modules/          # Feature modules
│   │   │   ├── auth/
│   │   │   ├── affaires/
│   │   │   ├── sinistres/
│   │   │   ├── finances/
│   │   │   ├── comptabilite/
│   │   │   └── ...
│   │   ├── config/           # Configuration
│   │   ├── database/         # Database & seeds
│   │   └── main.ts           # Entry point
│   ├── uploads/              # File uploads
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── features/         # Feature modules
│   │   ├── components/       # Shared components
│   │   ├── api/              # API clients
│   │   ├── types/            # TypeScript types
│   │   └── App.tsx
│   └── package.json
│
├── md/                       # Documentation
├── deploy-ubuntu.sh          # Deployment script
├── DEPLOYMENT_GUIDE.md
├── QUICK_START.md
└── README.md
```

## 🔐 Security

- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing (bcrypt)
- CORS protection
- Input validation
- SQL injection prevention (TypeORM)
- XSS protection

## 🧪 Testing

```bash
# Backend tests
cd backend
npm run test

# Frontend tests
cd frontend
npm run test
```

## 📊 Database Schema

The system uses PostgreSQL with the following main entities:
- Users (authentication & roles)
- Assurés, Cédantes, Réassureurs (master data)
- Affaires (deals)
- Sinistres (claims)
- Encaissements, Décaissements (financial transactions)
- Settlements (situations)
- Journal Entries (accounting)
- Documents (GED)

## 🌍 Environment Variables

### Backend (.env)
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=ars_user
DATABASE_PASSWORD=your_password
DATABASE_NAME=ars_reinsurance
JWT_SECRET=your_secret
PORT=5000
NODE_ENV=production
CORS_ORIGINS=http://yourdomain.com
```

### Frontend (.env)
```env
VITE_API_URL=http://yourdomain.com/api
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend Framework | NestJS |
| Frontend Framework | React 18 + TypeScript |
| Database | PostgreSQL |
| ORM | TypeORM |
| Authentication | JWT + Passport |
| API | REST |
| Real-time | Socket.io |
| UI Components | Radix UI |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Data Fetching | TanStack Query |
| Build Tool | Vite |
| Process Manager | PM2 |
| Web Server | Nginx |

## 📝 User Roles

1. **Administrateur** - Full system access
2. **Directeur Général** - Read-only + reports
3. **Directeur Commercial** - Prospection & cotation
4. **Directeur Réassurance** - Technical operations
5. **Directeur Financier (DAF)** - Finance & accounting
6. **Responsable Production** - Deal management
7. **Chargé de Dossier** - Day-to-day operations
8. **Technicien Sinistres** - Claims handling
9. **Agent Financier** - Financial transactions
10. **Comptable** - Accounting entries

## 🤝 Contributing

This is a private enterprise application. For internal development:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit pull request
5. Wait for review

## 📄 License

Proprietary - ARS Tunisie © 2024

## 📞 Support

For issues or questions:
- Check logs: `pm2 logs ars-backend`
- Check documentation in `/md` folder
- Contact system administrator

## 🔄 Updates & Maintenance

### Update Application
```bash
cd /home/ars/reinsurance_ars
git pull origin main
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
pm2 restart ars-backend
sudo systemctl restart nginx
```

### Backup Database
```bash
pg_dump -U ars_user ars_reinsurance > backup_$(date +%Y%m%d).sql
```

### View Logs
```bash
pm2 logs ars-backend --lines 100
sudo tail -f /var/log/nginx/error.log
```

## 📈 Roadmap

- [ ] Mobile application
- [ ] Advanced analytics
- [ ] Email notifications
- [ ] Automated bordereaux sending
- [ ] Integration with external accounting systems
- [ ] Multi-language support
- [ ] Advanced reporting engine

## 🙏 Acknowledgments

Built for ARS Tunisie - Exclusive Aon representative in Tunisia

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Status:** Production Ready
