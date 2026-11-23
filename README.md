# 🚀 TestNix — Free Internet Speed Test

<p align="center">
  <strong>Test your internet speed. Understand your connection. Share your results.</strong>
</p>


  <p align="center">
  <a href="https://testnix-net.vercel.app/" target="_blank">
    🚀 Visit TestNix — https://testnix-net.vercel.app/
  </a>
    <a href="https://github.com/mdalihasanriyad/testnix">GitHub Repository</a>
</p>
  

---

## 🌐 About TestNix

**TestNix** is a modern, web-based internet speed testing platform designed to help users measure, understand, and monitor their internet connection.

It provides a clean and user-friendly experience for checking internet performance, viewing previous results, sharing speed reports, and managing scheduled tests.

Whether you're checking your home Wi-Fi, mobile data, or broadband connection, TestNix makes understanding your internet performance easier.

## ✨ Features

- **Internet Speed Test** — Measure your internet connection speed.
- **Recent Tests** — View previous speed test results.
- **Community Board** — Share speed test results with other users.
- **AI-Powered Insights** — Get AI-generated explanations of internet speed results.
- **Report Inbox** — Access saved speed test reports.
- **Scheduled Tests** — Schedule internet speed tests.
- **PDF Reports** — Generate downloadable speed test reports.
- **Responsive Design** — Enjoy a smooth experience across desktop, tablet, and mobile devices.
- **Cloud Database** — Store and retrieve speed test results.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React 19 | UI Development |
| TypeScript | Type Safety |
| TanStack Start | Application Framework |
| TanStack Router | Routing |
| Tailwind CSS 4 | Styling |
| Supabase | Backend and Database |
| Drizzle ORM | Database ORM |
| PostgreSQL | Database |
| Vercel | Deployment |
| AI SDK | AI-Powered Features |
| Lucide React | Icons |

## 🚀 Getting Started

Follow these steps to run TestNix locally.

### Prerequisites

- Node.js
- Bun
- Git
- Supabase account

### 1. Clone the Repository

```bash
git clone https://github.com/mdalihasanriyad/testnix.git
```

### 2. Navigate to the Project

```bash
cd testnix
```

### 3. Install Dependencies

```bash
bun install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_PROJECT_ID=your_supabase_project_id
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_URL=https://your_project.supabase.co

VITE_SUPABASE_PROJECT_ID=your_supabase_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_SUPABASE_URL=https://your_project.supabase.co
```

Add any additional API keys required by the features you enable.

### 5. Start Development Server

```bash
bun run dev
```

### 6. Build for Production

```bash
bun run build
```

### 7. Preview Production Build

```bash
bun run preview
```

## 📁 Project Structure

```text
testnix/
├── public/          # Static assets
├── src/             # Application source code
├── drizzle/         # Database schema and migrations
├── supabase/        # Supabase configuration
├── .lovable/        # Lovable project configuration
├── AGENTS.md        # AI development instructions
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🔐 Environment Variables

TestNix uses environment variables to configure its backend services.

Never commit private API keys, database passwords, or service-role keys to a public repository.

Keep your local `.env` file private and use Vercel Environment Variables for production deployments.

## 🚀 Deployment

TestNix is deployed on **Vercel**.

To deploy your own version:

1. Fork this repository.
2. Import the repository into Vercel.
3. Configure the required environment variables.
4. Deploy your application.

## 🗺️ Project Roadmap

- [x] Internet speed testing interface
- [x] Community speed test sharing
- [x] AI-generated result explanations
- [x] Cloud-based speed result storage
- [x] Report inbox
- [x] Scheduled test workflow
- [ ] Complete automated scheduled report emails
- [ ] Custom domain integration
- [ ] Automated email delivery with PDF report links
- [ ] Further performance and UX improvements

## 🤝 Contributing

Contributions, suggestions, and feedback are welcome!

If you find a bug or have an idea for improvement:

1. Fork the repository.
2. Create a new branch.
3. Make your changes.
4. Submit a pull request.

## 📄 License

This project is currently maintained by its author. Please contact the repository owner regarding reuse and licensing.

## 👨‍💻 Author

**Md. Ali Hasan Riyad**

- GitHub: [@mdalihasanriyad](https://github.com/mdalihasanriyad)
- Project: [TestNix](https://testnix-net.vercel.app/)

---

<p align="center">
  Made with ❤️ by Md. Ali Hasan Riyad
</p>
