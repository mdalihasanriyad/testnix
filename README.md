# 🚀 TestNix — Internet Speed Test Platform

<p align="center">
  <strong>Measure your speed. Monitor your connection. Stay connected.</strong>
</p>

<p align="center">
  A modern internet speed testing platform built to help users measure, understand, and monitor their internet performance.
</p>

<p align="center">
  <a href="https://testnix-net.vercel.app/" target="_blank">
    <strong>🌐 Live Link</strong>
  </a>
  &nbsp; • &nbsp;
  <a href="https://github.com/mdalihasanriyad/testnix" target="_blank">
    <strong>📂 GitHub Repository</strong>
  </a>
</p>

---

## 🌐 Overview

**TestNix** is a modern, web-based internet speed testing platform designed to make internet performance monitoring simple, accessible, and informative.

It provides tools to test internet speed, review historical results, share performance reports, and organize scheduled tests — all through a clean and responsive interface.

Whether you're using home broadband, Wi-Fi, or mobile data, TestNix helps you better understand your internet connection.

## ✨ Key Features

- **Internet Speed Testing** — Measure your internet connection performance.
- **Download & Upload Monitoring** — Understand your connection's transfer speeds.
- **Ping Monitoring** — Evaluate network response time.
- **Recent Test History** — Review previous speed test results.
- **Community Board** — Share and explore internet speed results.
- **AI-Powered Insights** — Get intelligent explanations of test results.
- **Report Inbox** — Access and manage saved reports.
- **Scheduled Testing** — Organize recurring internet speed tests.
- **PDF Report Generation** — Generate downloadable speed test reports.
- **Responsive Interface** — Optimized for desktop, tablet, and mobile devices.
- **Cloud Database Integration** — Store and retrieve application data.

## 🛠️ Technology Stack

TestNix is built using modern web technologies.

| Technology | Purpose |
|---|---|
| React 19 | User Interface |
| TypeScript | Type Safety |
| TanStack Start | Application Framework |
| TanStack Router | Routing |
| Tailwind CSS 4 | Styling |
| Supabase | Backend Services |
| PostgreSQL | Database |
| Drizzle ORM | Database Management |
| Vercel | Deployment |
| AI SDK | AI Integration |
| Lucide React | Icons |
| Bun | Package Management & Runtime |

## 📸 Preview

<p align="center">
  <a href="https://testnix-net.vercel.app/">
    <strong>Visit TestNix to explore the live application</strong>
  </a>
</p>

## 🚀 Getting Started

Follow the instructions below to run TestNix locally.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/)
- [Bun](https://bun.sh/)
- [Git](https://git-scm.com/)
- A [Supabase](https://supabase.com/) account

### 1. Clone the Repository

```bash
git clone https://github.com/mdalihasanriyad/testnix.git
```

### 2. Navigate to the Project Directory

```bash
cd testnix
```

### 3. Install Dependencies

```bash
bun install
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory and configure your Supabase credentials.

```env
SUPABASE_PROJECT_ID=your_supabase_project_id
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_URL=https://your_project.supabase.co

VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_SUPABASE_URL=https://your_project.supabase.co
```

Add any other environment variables required by the features you enable.

**Security Note:** Never expose private API keys, database credentials, or Supabase service-role keys in client-side code or public repositories.

### 5. Start the Development Server

```bash
bun run dev
```

### 6. Build for Production

```bash
bun run build
```

### 7. Preview the Production Build

```bash
bun run preview
```

## 📁 Project Structure

```text
testnix/
├── public/             # Static assets
├── src/                # Application source code
├── drizzle/            # Database schema and migrations
├── supabase/           # Supabase configuration
├── .lovable/           # Lovable configuration
├── AGENTS.md           # AI development instructions
├── drizzle.config.ts   # Drizzle ORM configuration
├── package.json        # Project dependencies
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
├── bun.lock            # Bun lockfile
└── README.md           # Project documentation
```

## 🔐 Security & Configuration

Security is an important part of TestNix.

- Keep `.env` files out of version control.
- Use `.gitignore` to prevent accidental credential exposure.
- Store production secrets in Vercel Environment Variables.
- Use appropriate Supabase Row Level Security (RLS) policies.
- Never expose server-side credentials in frontend code.

## ☁️ Deployment

TestNix is deployed using **Vercel**.

You can deploy your own instance:

1. Fork this repository.
2. Import the repository into your Vercel account.
3. Configure the required environment variables.
4. Deploy the application.
5. Connect a custom domain if needed.

**Live Website:** https://testnix-net.vercel.app/

## 🗺️ Roadmap

The project continues to evolve with new features and improvements.

- [x] Modern internet speed testing interface
- [x] Speed test result history
- [x] Community speed sharing
- [x] AI-powered result insights
- [x] Report management
- [x] Scheduled testing workflow
- [ ] Automated scheduled report emails
- [ ] Email delivery with PDF report links
- [ ] Custom domain integration
- [ ] Additional performance improvements
- [ ] Further UI/UX enhancements

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

If you'd like to contribute:

1. Fork the repository.
2. Create a new feature branch.
3. Make your changes.
4. Commit your changes.
5. Submit a pull request.

For major changes, consider opening an issue first to discuss your ideas.

## 📄 License

No open-source license has currently been specified for this project. All rights are reserved by the project owner unless otherwise stated.

## 👨‍💻 Author

**Md. Ali Hasan Riyad**

Full Stack Developer | Bangladesh

- GitHub: [@mdalihasanriyad](https://github.com/mdalihasanriyad)
- Project: [TestNix](https://testnix-net.vercel.app/)
- Repository: [github.com/mdalihasanriyad/testnix](https://github.com/mdalihasanriyad/testnix)

---

<p align="center">
  <strong>Built with ❤️ by Md. Ali Hasan Riyad</strong>
</p>

<p align="center">
  <a href="https://testnix-net.vercel.app/">TestNix</a> — Making Internet Performance Easier to Understand.
</p>
